import { supabaseAdmin } from "@/lib/supabase-admin";
import { NIGERIAN_STATES } from "@/lib/nigeria";

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { error: "Marketplace listings are temporarily unavailable." },
      { status: 503 }
    );
  }

  const params = new URL(request.url).searchParams;
  const state = params.get("state")?.trim() ?? "";

  if (state && !NIGERIAN_STATES.includes(state as (typeof NIGERIAN_STATES)[number])) {
    return Response.json({ error: "Choose a valid Nigerian state." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("products")
    .select(
      "id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id, vendor_profiles!inner(business_name, state, lga, town, status, verified)"
    )
    .eq("approval_status", "approved")
    .eq("is_available", true)
    .gt("quantity_available", 0)
    .eq("vendor_profiles.status", "active")
    .eq("vendor_profiles.verified", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (state) {
    query = query.eq("vendor_profiles.state", state);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { error: "We couldn't load marketplace listings. Please try again." },
      { status: 500 }
    );
  }

  return Response.json(
    { products: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
