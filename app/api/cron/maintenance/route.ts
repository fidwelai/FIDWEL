import { supabaseAdmin } from "@/lib/supabase-admin";
import { STALE_UNPAID_ORDER_HOURS } from "@/lib/orders";
import {
  cronUnauthorized,
  cronUnavailable,
  isCronAuthorized,
  isCronConfigured,
} from "@/lib/cron";

// Runs housekeeping and returns a small digest. Schedule it (daily is enough)
// and authenticate with CRON_SECRET — see lib/cron.ts and the README.
export async function GET(request: Request) {
  if (!isCronConfigured() || !supabaseAdmin) {
    return cronUnavailable();
  }

  if (!isCronAuthorized(request)) {
    return cronUnauthorized();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleCutoffIso = new Date(
    now.getTime() - STALE_UNPAID_ORDER_HOURS * 60 * 60 * 1000
  ).toISOString();

  try {
    // 1. Expire paid subscriptions whose billing period has ended.
    const { data: expired, error: expireError } = await supabaseAdmin
      .from("vendor_subscriptions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("current_period_end", nowIso)
      .select("id");

    if (expireError) {
      throw expireError;
    }

    // 2. Cancel abandoned unpaid orders so they stop cluttering queues.
    const { data: cancelled, error: cancelError } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .eq("payment_status", "unpaid")
      .lt("created_at", staleCutoffIso)
      .select("id");

    if (cancelError) {
      throw cancelError;
    }

    // 3. Digest counts for follow-up (surfaced on the admin dashboard).
    const [pendingVendors, expiredSubscriptions, staleUnpaidOrders] =
      await Promise.all([
        supabaseAdmin
          .from("vendor_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("vendor_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "expired"),
        supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("payment_status", "unpaid")
          .lt("created_at", staleCutoffIso),
      ]);

    return Response.json({
      ok: true,
      ranAt: nowIso,
      jobs: {
        expiredSubscriptions: expired?.length ?? 0,
        cancelledOrders: cancelled?.length ?? 0,
      },
      digest: {
        pendingVendors: pendingVendors.count ?? 0,
        expiredSubscriptions: expiredSubscriptions.count ?? 0,
        staleUnpaidOrders: staleUnpaidOrders.count ?? 0,
        staleOrderHours: STALE_UNPAID_ORDER_HOURS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
