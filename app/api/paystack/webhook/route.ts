import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPlan } from "@/lib/plans";
import { emailForUser, notifyOrderPaid, notifySubscriptionActive } from "@/lib/notify";

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    metadata?: {
      orderId?: string;
      type?: string;
      vendorId?: string;
      plan?: string;
    } | null;
  };
};

function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const computed = Buffer.from(expected, "utf8");

  if (received.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(received, computed);
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !supabaseAdmin) {
    return Response.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!signature || !isValidSignature(rawBody, signature, secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return Response.json({ received: true });
  }

  const metadata = event.data?.metadata ?? {};
  const reference = event.data?.reference ?? "";
  const paidKobo = Number(event.data?.amount ?? 0);
  const paidCurrency = (event.data?.currency ?? "").toUpperCase();

  if (metadata.type === "vendor_subscription") {
    const vendorId = typeof metadata.vendorId === "string" ? metadata.vendorId : "";
    const plan = getPlan(typeof metadata.plan === "string" ? metadata.plan : "");

    if (
      vendorId &&
      plan &&
      plan.price > 0 &&
      (paidCurrency === "" || paidCurrency === "NGN") &&
      paidKobo === Math.round(plan.price * 100)
    ) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabaseAdmin.from("vendor_subscriptions").upsert(
        {
          vendor_id: vendorId,
          plan: plan.id,
          status: "active",
          amount: plan.price,
          currency: "NGN",
          billing_interval: "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          payment_reference: reference,
        },
        { onConflict: "vendor_id" }
      );

      const { data: vendorProfile } = await supabaseAdmin
        .from("vendor_profiles")
        .select("user_id")
        .eq("id", vendorId)
        .maybeSingle();

      if (vendorProfile?.user_id) {
        await notifySubscriptionActive({
          userId: vendorProfile.user_id,
          email: await emailForUser(vendorProfile.user_id),
          planName: plan.name,
          periodEnd: periodEnd.toISOString(),
        });
      }
    }

    return Response.json({ received: true });
  }

  const orderId =
    (typeof metadata.orderId === "string" ? metadata.orderId : "") || "";

  if (!orderId) {
    return Response.json({ received: true });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total, currency, payment_status, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.payment_status === "paid") {
    return Response.json({ received: true });
  }

  const expectedKobo = Math.round(Number(order.total) * 100);

  if (paidCurrency && paidCurrency !== String(order.currency).toUpperCase()) {
    return Response.json({ received: true });
  }

  if (paidKobo !== expectedKobo) {
    return Response.json({ received: true });
  }

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      payment_reference: reference,
    })
    .eq("id", order.id);

  if (order.customer_id) {
    await notifyOrderPaid({
      userId: order.customer_id,
      email: await emailForUser(order.customer_id),
      orderId: order.id,
      total: Number(order.total),
    });
  }

  return Response.json({ received: true });
}
