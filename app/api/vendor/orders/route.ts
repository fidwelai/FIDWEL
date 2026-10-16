import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_STATUSES = new Set([
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

type UpdateBody = {
  itemId?: unknown;
  status?: unknown;
};

function computeOrderStatus(statuses: string[], current: string): string {
  if (statuses.length === 0) {
    return current;
  }

  if (statuses.every((status) => status === "cancelled")) {
    return "cancelled";
  }

  if (statuses.every((status) => status === "delivered")) {
    return "delivered";
  }

  if (statuses.some((status) => status === "shipped" || status === "delivered")) {
    return "shipped";
  }

  if (statuses.some((status) => status === "processing")) {
    return "processing";
  }

  return current;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: "This action is unavailable right now." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json({ error: "Your session has expired." }, { status: 401 });
  }

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const itemId = Number(body.itemId);
  const status = typeof body.status === "string" ? body.status : "";

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return Response.json({ error: "Invalid order item." }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }

  const { data: vendor } = await supabaseAdmin
    .from("vendor_profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!vendor) {
    return Response.json({ error: "No vendor profile for this account." }, { status: 403 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("order_items")
    .select("id, order_id, vendor_id, product_id, quantity, fulfillment_status")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) {
    return Response.json({ error: "Could not load the order item." }, { status: 500 });
  }

  if (!item || item.vendor_id !== vendor.id) {
    return Response.json({ error: "This item is not on your orders." }, { status: 403 });
  }

  const wasCancelled = item.fulfillment_status === "cancelled";
  const nowCancelled = status === "cancelled";
  const productId = item.product_id == null ? null : Number(item.product_id);
  const quantity = Number(item.quantity);

  // Reopening a cancelled item needs its stock again, so reserve it before the
  // status change and refuse the change if there is not enough left.
  if (wasCancelled && !nowCancelled && productId) {
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc(
      "decrement_product_stock",
      { target_product_id: productId, amount: quantity }
    );

    if (reserveError || reserved !== true) {
      return Response.json(
        { error: "There is not enough stock to reopen this item." },
        { status: 409 }
      );
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("order_items")
    .update({ fulfillment_status: status })
    .eq("id", item.id);

  if (updateError) {
    // Undo the reservation we just made for a reopen.
    if (wasCancelled && !nowCancelled && productId) {
      await supabaseAdmin.rpc("increment_product_stock", {
        target_product_id: productId,
        amount: quantity,
      });
    }

    return Response.json({ error: "Could not update the item." }, { status: 500 });
  }

  // Cancelling a single item returns its reserved stock immediately. The
  // order-level trigger only restocks the whole order, and it skips items that
  // are already cancelled, so nothing is ever returned twice.
  if (!wasCancelled && nowCancelled && productId) {
    await supabaseAdmin.rpc("increment_product_stock", {
      target_product_id: productId,
      amount: quantity,
    });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", item.order_id)
    .maybeSingle();

  let orderStatus = order?.status ?? "pending";

  if (order) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("fulfillment_status")
      .eq("order_id", order.id);

    const statuses = (items ?? []).map((row) => String(row.fulfillment_status));
    const next = computeOrderStatus(statuses, order.status);

    if (next !== order.status && order.status !== "refunded") {
      await supabaseAdmin.from("orders").update({ status: next }).eq("id", order.id);
      orderStatus = next;
    }
  }

  return Response.json({ ok: true, itemId: item.id, status, orderStatus });
}
