import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!supabaseAdmin) {
    return Response.json({ error: "Delivery tracking is unavailable." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData.user) {
    return Response.json({ error: "Your session has expired." }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, delivery_agent_id, delivery_status")
    .eq("id", id)
    .eq("customer_id", userData.user.id)
    .maybeSingle();

  if (error) return Response.json({ error: "Could not load delivery tracking." }, { status: 500 });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  if (!order.delivery_agent_id) {
    return Response.json({ deliveryStatus: order.delivery_status, agent: null });
  }

  const [{ data: agentProfile }, { data: userProfile }] = await Promise.all([
    supabaseAdmin
      .from("delivery_agent_profiles")
      .select("state, lga, town, phone")
      .eq("user_id", order.delivery_agent_id)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", order.delivery_agent_id)
      .maybeSingle(),
  ]);

  return Response.json({
    deliveryStatus: order.delivery_status,
    agent: {
      name: userProfile?.full_name ?? "FIDWEL delivery agent",
      phone: agentProfile?.phone ?? userProfile?.phone ?? null,
      area: [agentProfile?.town, agentProfile?.lga, agentProfile?.state].filter(Boolean).join(", "),
    },
  });
}
