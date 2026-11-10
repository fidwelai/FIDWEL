import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAdmin, staffError } from "@/lib/admin";

export async function GET(request: Request) {
  const result = await resolveAdmin(request);
  const denied = staffError(result);

  if (result.status !== "ok") {
    return denied!;
  }

  const { data, error } = await supabaseAdmin!
    .from("vendor_verification_reports")
    .select(
      "id, vendor_id, agent_id, identity_confirmed, location_confirmed, products_confirmed, recommendation, notes, review_status, admin_notes, created_at, vendor_profiles(business_name, state, lga, town)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: "Could not load field reports." }, { status: 500 });
  }

  const agentIds = [...new Set((data ?? []).map((report) => report.agent_id))];
  const { data: agents, error: agentsError } = agentIds.length
    ? await supabaseAdmin!
        .from("profiles")
        .select("id, full_name")
        .in("id", agentIds)
    : { data: [], error: null };

  if (agentsError) {
    return Response.json({ error: "Could not load report authors." }, { status: 500 });
  }

  const agentNames = new Map((agents ?? []).map((agent) => [agent.id, agent.full_name]));
  const reports = (data ?? []).map((report) => ({
    ...report,
    agent_name: agentNames.get(report.agent_id) ?? "FIDWEL agent",
  }));

  return Response.json({ reports });
}

export async function PATCH(request: Request) {
  const result = await resolveAdmin(request);
  const denied = staffError(result);

  if (result.status !== "ok") {
    return denied!;
  }

  let body: { reportId?: unknown; adminNotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const reportId = Number(body.reportId);
  const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : "";

  if (!Number.isInteger(reportId) || reportId <= 0 || adminNotes.length > 2000) {
    return Response.json({ error: "Invalid report review." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin!
    .from("vendor_verification_reports")
    .update({
      review_status: "reviewed",
      admin_notes: adminNotes || null,
      reviewed_by: result.staff.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("review_status", "pending")
    .select("id, review_status, admin_notes, reviewed_at")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Could not save the report review." }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "This report was already reviewed or no longer exists." }, { status: 409 });
  }

  return Response.json({ report: data });
}
