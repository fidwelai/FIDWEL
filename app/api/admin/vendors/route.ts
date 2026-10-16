import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAdmin, staffError } from "@/lib/admin";
import { emailForUser, notifyVendorDecision } from "@/lib/notify";

type ModerationAction = "approve" | "reject" | "suspend" | "reactivate";

const ACTIONS: Record<ModerationAction, { status: string; verified: boolean }> = {
  approve: { status: "active", verified: true },
  reactivate: { status: "active", verified: true },
  reject: { status: "rejected", verified: false },
  suspend: { status: "suspended", verified: false },
};

function isAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && value in ACTIONS;
}

export async function POST(request: Request) {
  const result = await resolveAdmin(request);
  const denied = staffError(result);

  if (denied) {
    return denied;
  }

  if (!supabaseAdmin) {
    return Response.json({ error: "This tool is unavailable." }, { status: 503 });
  }

  let body: { vendorId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";

  if (!vendorId || !isAction(body.action)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const patch = ACTIONS[body.action];

  const { data, error } = await supabaseAdmin
    .from("vendor_profiles")
    .update({ status: patch.status, verified: patch.verified })
    .eq("id", vendorId)
    .select("id, user_id, business_name, status, verified")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Could not update the vendor." }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Vendor not found." }, { status: 404 });
  }

  if (body.action === "approve" || body.action === "reactivate" || body.action === "reject") {
    await notifyVendorDecision({
      userId: data.user_id,
      email: await emailForUser(data.user_id),
      businessName: data.business_name,
      approved: body.action !== "reject",
    });
  }

  return Response.json({ ok: true, vendor: data });
}
