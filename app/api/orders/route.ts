import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeDeliveryFee } from "@/lib/orders";
import { notifyOrderPlaced } from "@/lib/notify";

type IncomingItem = {
  productId?: unknown;
  quantity?: unknown;
};

type DeliveryDetails = {
  contact_name?: unknown;
  contact_phone?: unknown;
  state?: unknown;
  lga?: unknown;
  town?: unknown;
  address?: unknown;
  notes?: unknown;
};

type OrderItemInsert = {
  order_id: string;
  product_id: number;
  vendor_id: string | null;
  product_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return badRequest("Checkout is not available right now. Please try again later.", 503);
  }

  const admin = supabaseAdmin;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return badRequest("Please sign in to place an order.", 401);
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return badRequest("Your session has expired. Please sign in again.", 401);
  }

  let body: { items?: IncomingItem[]; delivery?: DeliveryDetails };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request.");
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const delivery = body.delivery ?? {};

  const requested = rawItems
    .map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.productId) &&
        item.productId > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );

  if (requested.length === 0) {
    return badRequest("Your cart is empty.");
  }

  const contactName = asTrimmed(delivery.contact_name);
  const contactPhone = asTrimmed(delivery.contact_phone);
  const deliveryState = asTrimmed(delivery.state);
  const deliveryLga = asTrimmed(delivery.lga);
  const deliveryTown = asTrimmed(delivery.town);
  const deliveryAddress = asTrimmed(delivery.address);
  const notes = asTrimmed(delivery.notes);

  if (!contactName || !contactPhone || !deliveryState || !deliveryAddress) {
    return badRequest("Please complete your delivery details.");
  }

  const productIds = [...new Set(requested.map((item) => item.productId))];
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, vendor_id, name, unit, price, quantity_available, is_available, approval_status")
    .in("id", productIds);

  if (productsError) {
    return badRequest("We could not verify your items. Please try again.", 500);
  }

  const productMap = new Map(
    (products ?? []).map((product) => [Number(product.id), product])
  );

  const orderItems: Omit<OrderItemInsert, "order_id">[] = [];
  let subtotal = 0;

  for (const item of requested) {
    const product = productMap.get(item.productId);

    if (!product || !product.is_available || product.approval_status !== "approved") {
      return badRequest("One of your items is no longer available.", 409);
    }

    const available = Number(product.quantity_available);

    if (available < item.quantity) {
      return badRequest(
        `Only ${available} ${product.unit} of ${product.name} is available.`,
        409
      );
    }

    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    orderItems.push({
      product_id: Number(product.id),
      vendor_id: product.vendor_id ?? null,
      product_name: product.name,
      unit: product.unit,
      unit_price: unitPrice,
      quantity: item.quantity,
      line_total: lineTotal,
    });
  }

  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;

  // Reserve stock atomically. If any line cannot be reserved, release the ones
  // already reserved and stop — the order is never created, so a shopper can
  // never buy more than is available.
  const reserved: { productId: number; quantity: number }[] = [];

  const releaseReserved = async () => {
    await Promise.all(
      reserved.map((entry) =>
        admin.rpc("increment_product_stock", {
          target_product_id: entry.productId,
          amount: entry.quantity,
        })
      )
    );
  };

  for (const item of orderItems) {
    const { data: reservation, error: reserveError } = await supabaseAdmin.rpc(
      "decrement_product_stock",
      { target_product_id: item.product_id, amount: item.quantity }
    );

    if (reserveError || reservation !== true) {
      await releaseReserved();
      return badRequest(
        "One of your items is no longer available in that quantity.",
        409
      );
    }

    reserved.push({ productId: item.product_id, quantity: item.quantity });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_id: userData.user.id,
      status: "pending",
      payment_status: "unpaid",
      payment_provider: "paystack",
      currency: "NGN",
      subtotal,
      delivery_fee: deliveryFee,
      total,
      contact_name: contactName,
      contact_phone: contactPhone,
      delivery_state: deliveryState,
      delivery_lga: deliveryLga || null,
      delivery_town: deliveryTown || null,
      delivery_address: deliveryAddress,
      notes: notes || null,
    })
    .select("id, total, currency")
    .single();

  if (orderError || !order) {
    await releaseReserved();
    return badRequest("We could not place your order. Please try again.", 500);
  }

  const { error: itemsError } = await supabaseAdmin
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    await releaseReserved();
    return badRequest("We could not place your order. Please try again.", 500);
  }

  await notifyOrderPlaced({
    userId: userData.user.id,
    email: userData.user.email,
    orderId: order.id,
    total: Number(order.total),
  });

  return Response.json({
    order: {
      id: order.id,
      total: Number(order.total),
      currency: order.currency,
    },
  });
}
