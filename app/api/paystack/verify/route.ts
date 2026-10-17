import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailForUser, notifyOrderPaid } from "@/lib/notify";

type PaystackVerifyPayload = {
  status?: boolean;
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    reference?: string;
    metadata?: { orderId?: string } | null;
  };
};

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !supabaseAdmin) {
    return Response.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() ?? "";

  if (!accessToken) {
    return Response.json({ error: "Sign in to verify this payment." }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    return Response.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  }

  let body: { reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";

  if (!reference) {
    return Response.json({ error: "Missing payment reference." }, { status: 400 });
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
      }
    );
  } catch {
    return Response.json({ error: "Could not reach the payment provider." }, { status: 502 });
  }

  const payload = (await verifyResponse.json().catch(() => null)) as
    | PaystackVerifyPayload
    | null;

  if (!verifyResponse.ok || !payload?.status || payload.data?.status !== "success") {
    return Response.json({ error: "Payment was not successful." }, { status: 402 });
  }

  const orderId =
    typeof payload.data.metadata?.orderId === "string"
      ? payload.data.metadata.orderId
      : "";

  if (!orderId) {
    return Response.json({ error: "Payment is missing an order reference." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, total, currency, payment_status, payment_reference, customer_id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (orderError) {
    return Response.json({ error: "Could not load the order." }, { status: 500 });
  }

  if (!order) {
    return Response.json({ error: "Order not found for this account." }, { status: 404 });
  }

  const confirmedReference = payload.data.reference ?? "";
  const confirmedCurrency = (payload.data.currency ?? "").toUpperCase();

  if (
    !confirmedReference ||
    confirmedReference !== reference ||
    !reference.startsWith(`${order.id}-`)
  ) {
    return Response.json(
      { error: "Payment reference does not match this order." },
      { status: 409 }
    );
  }

  if (confirmedCurrency !== String(order.currency).toUpperCase()) {
    return Response.json(
      { error: "Payment currency does not match the order." },
      { status: 409 }
    );
  }

  const paidKobo = Number(payload.data.amount ?? 0);
  const expectedKobo = Math.round(Number(order.total) * 100);

  if (!Number.isFinite(paidKobo) || paidKobo !== expectedKobo) {
    return Response.json(
      { error: "Payment amount does not match the order." },
      { status: 409 }
    );
  }

  if (order.payment_status === "paid") {
    if (order.payment_reference === reference) {
      return Response.json({ ok: true, alreadyPaid: true });
    }

    return Response.json(
      { error: "This order has already been paid using another reference." },
      { status: 409 }
    );
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      payment_reference: reference,
    })
    .eq("id", order.id)
    .eq("customer_id", user.id)
    .eq("payment_status", "unpaid")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return Response.json(
      { error: "We could not confirm your payment." },
      { status: 500 }
    );
  }

  if (!updatedOrder) {
    const { data: latestOrder } = await supabaseAdmin
      .from("orders")
      .select("payment_status, payment_reference")
      .eq("id", order.id)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (
      latestOrder?.payment_status === "paid" &&
      latestOrder.payment_reference === reference
    ) {
      return Response.json({ ok: true, alreadyPaid: true });
    }

    return Response.json(
      { error: "Payment confirmation is still pending. Please refresh your order shortly." },
      { status: 409 }
    );
  }

  if (order.customer_id) {
    await notifyOrderPaid({
      userId: order.customer_id,
      email: await emailForUser(order.customer_id),
      orderId: order.id,
      total: Number(order.total),
    });
  }

  return Response.json({ ok: true });
}
