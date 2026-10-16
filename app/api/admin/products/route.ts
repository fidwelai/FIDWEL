import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAdmin, staffError } from "@/lib/admin";

type ProductAction = "approve" | "reject";

const ACTIONS: Record<ProductAction, string> = {
  approve: "approved",
  reject: "rejected",
};

function isAction(value: unknown): value is ProductAction {
  return value === "approve" || value === "reject";
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

  let body: { productId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const productId = Number(body.productId);

  if (!Number.isInteger(productId) || productId <= 0 || !isAction(body.action)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({ approval_status: ACTIONS[body.action] })
    .eq("id", productId)
    .select("id, approval_status")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Could not update the product." }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  return Response.json({ ok: true, product: data });
}
