import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailForUser, notifyOrderPaid } from "@/lib/notify";

type VerifyRequestBody = {
  reference?: unknown;
  orderId?: unknown;
};

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

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const reference = typeof body.reference === "string" ? body.reference.trim() : "";

  if (!reference) {
    return Response.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    }
  );

  const payload = (await verifyResponse.json().catch(() => null)) as
    | PaystackVerifyPayload
    | null;

  if (!verifyResponse.ok || !payload?.status || payload.data?.status !== "success") {
    return Response.json({ error: "Payment was not successful." }, { status: 402 });
  }

  const orderId =
    (typeof payload.data?.metadata?.orderId === "string"
      ? payload.data.metadata.orderId
      : "") || (typeof body.orderId === "string" ? body.orderId : "");

  if (!orderId) {
    return Response.json({ error: "Payment is missing an order." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, total, currency, payment_status, customer_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.payment_status === "paid") {
    return Response.json({ ok: true });
  }

  const confirmedReference = payload.data?.reference ?? "";
  const confirmedCurrency = payload.data?.currency ?? "";

  if (confirmedReference && confirmedReference !== reference) {
    return Response.json(
      { error: "Payment reference does not match." },
      { status: 409 }
    );
  }

  if (
    confirmedCurrency &&
    confirmedCurrency.toUpperCase() !== String(order.currency).toUpperCase()
  ) {
    return Response.json(
      { error: "Payment currency does not match the order." },
      { status: 409 }
    );
  }

  const paidKobo = Number(payload.data?.amount ?? 0);
  const expectedKobo = Math.round(Number(order.total) * 100);

  if (paidKobo !== expectedKobo) {
    return Response.json(
      { error: "Payment amount does not match the order." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      payment_reference: reference,
    })
    .eq("id", order.id);

  if (updateError) {
    return Response.json(
      { error: "We could not confirm your payment." },
      { status: 500 }
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
