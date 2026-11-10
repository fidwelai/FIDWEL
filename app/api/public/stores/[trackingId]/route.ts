import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await context.params;

  if (!UUID.test(trackingId)) {
    return Response.json({ error: "Vendor store not found." }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return Response.json(
      { error: "Vendor stores are temporarily unavailable." },
      { status: 503 }
    );
  }

  const { data: vendor, error: vendorError } = await supabaseAdmin
    .from("vendor_profiles")
    .select(
      "id, sales_tracking_id, business_name, description, state, lga, town, created_at"
    )
    .eq("sales_tracking_id", trackingId)
    .eq("status", "active")
    .eq("verified", true)
    .maybeSingle();

  if (vendorError) {
    console.error("Public vendor store lookup failed:", vendorError);
    return Response.json(
      { error: "We couldn't load this vendor store. Please try again." },
      { status: 500 }
    );
  }

  if (!vendor) {
    return Response.json({ error: "Verified vendor store not found." }, { status: 404 });
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select(
      "id, name, description, price, unit, quantity_available, image_url, category_id"
    )
    .eq("vendor_id", vendor.id)
    .eq("approval_status", "approved")
    .eq("is_available", true)
    .gt("quantity_available", 0)
    .order("created_at", { ascending: false })
    .limit(100);

  if (productsError) {
    console.error("Public vendor store products lookup failed:", productsError);
    return Response.json(
      { error: "We couldn't load this vendor's products. Please try again." },
      { status: 500 }
    );
  }

  return Response.json(
    {
      vendor: {
        id: vendor.id,
        trackingId: vendor.sales_tracking_id,
        businessName: vendor.business_name,
        description: vendor.description,
        state: vendor.state,
        lga: vendor.lga,
        town: vendor.town,
        verified: true,
        since: vendor.created_at,
      },
      products: products ?? [],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
