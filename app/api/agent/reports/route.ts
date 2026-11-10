import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAgent, staffError } from "@/lib/admin";

type ReportBody = {
  vendorId?: unknown;
  identityConfirmed?: unknown;
  locationConfirmed?: unknown;
  productsConfirmed?: unknown;
  recommendation?: unknown;
  notes?: unknown;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOMMENDATIONS = new Set(["approve", "follow_up", "reject"]);

export async function GET(request: Request) {
  const result = await resolveAgent(request);
  const denied = staffError(result);

  if (result.status !== "ok") {
    return denied!;
  }

  const { data, error } = await supabaseAdmin!
    .from("vendor_verification_reports")
    .select(
      "id, vendor_id, identity_confirmed, location_confirmed, products_confirmed, recommendation, notes, review_status, admin_notes, created_at"
    )
    .eq("agent_id", result.staff.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Could not load field reports." }, { status: 500 });
  }

  return Response.json({ reports: data ?? [] });
}

export async function POST(request: Request) {
  const result = await resolveAgent(request);
  const denied = staffError(result);

  if (result.status !== "ok") {
    return denied!;
  }

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (
    !UUID.test(vendorId) ||
    typeof body.identityConfirmed !== "boolean" ||
    typeof body.locationConfirmed !== "boolean" ||
    typeof body.productsConfirmed !== "boolean" ||
    typeof body.recommendation !== "string" ||
    !RECOMMENDATIONS.has(body.recommendation) ||
    notes.length > 2000
  ) {
    return Response.json({ error: "Complete the field report with valid details." }, { status: 400 });
  }

  const { data: vendor, error: vendorError } = await supabaseAdmin!
    .from("vendor_profiles")
    .select("id")
    .eq("id", vendorId)
    .eq("agent_id", result.staff.userId)
    .maybeSingle();

  if (vendorError) {
    return Response.json({ error: "Could not verify this vendor assignment." }, { status: 500 });
  }

  if (!vendor) {
    return Response.json({ error: "You can only report on vendors assigned to you." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin!
    .from("vendor_verification_reports")
    .insert({
      vendor_id: vendorId,
      agent_id: result.staff.userId,
      identity_confirmed: body.identityConfirmed,
      location_confirmed: body.locationConfirmed,
      products_confirmed: body.productsConfirmed,
      recommendation: body.recommendation,
      notes,
    })
    .select(
      "id, vendor_id, identity_confirmed, location_confirmed, products_confirmed, recommendation, notes, review_status, admin_notes, created_at"
    )
    .single();

  if (error || !data) {
    return Response.json({ error: "Could not submit the field report." }, { status: 500 });
  }

  return Response.json({ report: data }, { status: 201 });
}
