import { supabaseAdmin } from "@/lib/supabase-admin";

type SalesTrackingSummary = {
  attributed_orders: number;
  attributed_sales: number;
};

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function parseSummary(value: unknown): SalesTrackingSummary | null {
  if (typeof value !== "object" || value === null) return null;

  const row = value as Record<string, unknown>;
  const attributedOrders = Number(row.attributed_orders);
  const attributedSales = Number(row.attributed_sales);

  if (!Number.isFinite(attributedOrders) || !Number.isFinite(attributedSales)) {
    return null;
  }

  return {
    attributed_orders: attributedOrders,
    attributed_sales: attributedSales,
  };
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return badRequest("Sales tracking is temporarily unavailable.", 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return badRequest("Please sign in to view sales tracking.", 401);

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return badRequest("Your session has expired. Please sign in again.", 401);
  }

  const { data: vendor, error: vendorError } = await supabaseAdmin
    .from("vendor_profiles")
    .select("id, sales_tracking_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (vendorError) {
    console.error("Vendor sales tracking profile lookup failed:", vendorError);
    return badRequest("We couldn't load your sales tracking details.", 500);
  }
  if (!vendor) return badRequest("No vendor profile was found.", 404);

  const { data: summary, error: summaryError } = await supabaseAdmin
    .rpc("get_vendor_sales_tracking_summary", {
      target_vendor_id: vendor.id,
    })
    .maybeSingle();
  const parsedSummary = parseSummary(summary);

  if (summaryError || !parsedSummary) {
    console.error("Vendor attributed sales summary failed:", summaryError);
    return badRequest("We couldn't load your attributed sales.", 500);
  }

  return Response.json({
    trackingId: vendor.sales_tracking_id,
    attributedOrders: parsedSummary.attributed_orders,
    attributedSales: parsedSummary.attributed_sales,
  });
}
