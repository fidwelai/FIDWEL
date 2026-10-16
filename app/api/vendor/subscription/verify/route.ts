import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPlan } from "@/lib/plans";
import { notifySubscriptionActive } from "@/lib/notify";

type SubscriptionBody = {
  plan?: unknown;
  reference?: unknown;
};

type PaystackVerifyPayload = {
  status?: boolean;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: {
      type?: string;
      vendorId?: string;
      plan?: string;
    } | null;
  };
};

function oneMonthFromNow(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !supabaseAdmin) {
    return Response.json({ error: "Billing is not configured yet." }, { status: 503 });
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

  let body: SubscriptionBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const planId = typeof body.plan === "string" ? body.plan : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";

  const plan = getPlan(planId);

  if (!plan || plan.price <= 0) {
    return Response.json({ error: "Unknown plan." }, { status: 400 });
  }

  if (!reference) {
    return Response.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const { data: vendor } = await supabaseAdmin
    .from("vendor_profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!vendor) {
    return Response.json({ error: "No vendor profile for this account." }, { status: 403 });
  }

  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" }
  );

  const payload = (await verifyResponse.json().catch(() => null)) as
    | PaystackVerifyPayload
    | null;

  if (!verifyResponse.ok || !payload?.status || payload.data?.status !== "success") {
    return Response.json({ error: "Payment was not successful." }, { status: 402 });
  }

  const metadata = payload.data?.metadata ?? {};
  const expectedKobo = Math.round(plan.price * 100);
  const paidKobo = Number(payload.data?.amount ?? 0);

  if (
    metadata.type !== "vendor_subscription" ||
    metadata.vendorId !== vendor.id ||
    metadata.plan !== plan.id ||
    paidKobo !== expectedKobo
  ) {
    return Response.json(
      { error: "Payment details do not match this subscription." },
      { status: 409 }
    );
  }

  const periodStart = new Date();
  const periodEnd = oneMonthFromNow();

  const { error: upsertError } = await supabaseAdmin
    .from("vendor_subscriptions")
    .upsert(
      {
        vendor_id: vendor.id,
        plan: plan.id,
        status: "active",
        amount: plan.price,
        currency: "NGN",
        billing_interval: "monthly",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payment_reference: reference,
      },
      { onConflict: "vendor_id" }
    );

  if (upsertError) {
    return Response.json(
      { error: "We could not activate your subscription." },
      { status: 500 }
    );
  }

  await notifySubscriptionActive({
    userId: userData.user.id,
    email: userData.user.email,
    planName: plan.name,
    periodEnd: periodEnd.toISOString(),
  });

  return Response.json({ ok: true, plan: plan.id });
}
