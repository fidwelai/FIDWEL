import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!UUID.test(id)) {
    return Response.json({ error: "Vendor not found." }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return Response.json({ error: "Vendor information is temporarily unavailable." }, { status: 503 });
  }

  const { data: vendor, error } = await supabaseAdmin
    .from("vendor_profiles")
    .select("id, business_name, description, state, lga, town, status, verified, created_at")
    .eq("id", id)
    .eq("status", "active")
    .eq("verified", true)
    .maybeSingle();

  if (error || !vendor) {
    return Response.json({ error: "Verified vendor not found." }, { status: 404 });
  }

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price, unit, image_url")
    .eq("vendor_id", id)
    .eq("approval_status", "approved")
    .eq("is_available", true)
    .gt("quantity_available", 0)
    .order("created_at", { ascending: false })
    .limit(4);

  // Deliberately omit phone, street address, user ID and other private fields.
  return Response.json({
    vendor: {
      id: vendor.id,
      business_name: vendor.business_name,
      description: vendor.description,
      state: vendor.state,
      lga: vendor.lga,
      town: vendor.town,
      verified: true,
      since: vendor.created_at,
    },
    products: products ?? [],
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
