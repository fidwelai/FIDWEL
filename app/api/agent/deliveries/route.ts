import { resolveAgent, staffError } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DELIVERY_STATES = new Set(["assigned", "picked_up", "in_transit", "delivered"]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const access = await resolveAgent(request);
  const denied = staffError(access);
  if (denied) return denied;
  if (!supabaseAdmin || access.status !== "ok") {
    return fail("Delivery tools are unavailable.", 503);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("delivery_agent_profiles")
    .select("user_id, state, lga, town, phone, is_active")
    .eq("user_id", access.staff.userId)
    .maybeSingle();

  if (profileError) return fail("Could not load your delivery profile.", 500);

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_status, delivery_status, created_at, contact_name, contact_phone, delivery_state, delivery_lga, delivery_town, delivery_address, notes, delivery_fee, total")
    .eq("delivery_agent_id", access.staff.userId)
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersError) return fail("Could not load assigned deliveries.", 500);

  return Response.json({ profile: profile ?? null, deliveries: orders ?? [] });
}

export async function POST(request: Request) {
  const access = await resolveAgent(request);
  const denied = staffError(access);
  if (denied) return denied;
  if (!supabaseAdmin || access.status !== "ok") {
    return fail("Delivery tools are unavailable.", 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request.");
  }

  if (body.action === "save_area") {
    const state = clean(body.state);
    const lga = clean(body.lga);
    const town = clean(body.town);
    const phone = clean(body.phone);

    if (!state || !lga) return fail("State and LGA are required.");
    if (state.length > 100 || lga.length > 100 || town.length > 100 || phone.length > 40) {
      return fail("Please check the length of your delivery-area details.");
    }

    const { error } = await supabaseAdmin
      .from("delivery_agent_profiles")
      .upsert({
        user_id: access.staff.userId,
        state,
        lga,
        town: town || null,
        phone: phone || null,
        is_active: true,
      }, { onConflict: "user_id" });

    if (error) return fail("Could not save your service area. Apply the delivery database migration first.", 500);

    const { data: profile } = await supabaseAdmin
      .from("delivery_agent_profiles")
      .select("user_id, state, lga, town, phone, is_active")
      .eq("user_id", access.staff.userId)
      .single();

    const { data: waiting } = await supabaseAdmin
      .from("orders")
      .select("id, delivery_state, delivery_lga, delivery_town")
      .eq("payment_status", "paid")
      .is("delivery_agent_id", null)
      .eq("delivery_status", "pending")
      .ilike("delivery_state", state)
      .ilike("delivery_lga", lga)
      .limit(100);

    const eligible = (waiting ?? []).filter((order) => {
      return !town || clean(order.delivery_town).toLocaleLowerCase() === town.toLocaleLowerCase();
    });

    let assigned = 0;
    for (const order of eligible) {
      const { data: updated } = await supabaseAdmin
        .from("orders")
        .update({ delivery_agent_id: access.staff.userId, delivery_status: "assigned" })
        .eq("id", order.id)
        .eq("payment_status", "paid")
        .is("delivery_agent_id", null)
        .select("id")
        .maybeSingle();
      if (updated) assigned += 1;
    }

    return Response.json({ ok: true, profile, assigned });
  }

  const orderId = clean(body.orderId);
  const nextStatus = clean(body.status);
  if (!orderId || !DELIVERY_STATES.has(nextStatus) || nextStatus === "assigned") {
    return fail("Choose a valid delivery status.");
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, delivery_status, payment_status, delivery_agent_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) return fail("Could not load this delivery.", 500);
  if (!order || order.delivery_agent_id !== access.staff.userId) {
    return fail("This delivery is not assigned to your account.", 403);
  }
  if (order.payment_status !== "paid") return fail("Only paid orders can be delivered.", 409);

  const current = order.delivery_status;
  const allowedNext: Record<string, string[]> = {
    assigned: ["picked_up"],
    picked_up: ["in_transit"],
    in_transit: ["delivered"],
    delivered: [],
  };
  if (!(allowedNext[current] ?? []).includes(nextStatus)) {
    return fail("Delivery updates must follow the assigned → picked up → in transit → delivered sequence.", 409);
  }

  if (nextStatus === "picked_up") {
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("fulfillment_status")
      .eq("order_id", orderId);
    if (itemsError) return fail("Could not check vendor fulfilment.", 500);
    if (!items?.length || items.some((item) => !["shipped", "delivered"].includes(item.fulfillment_status))) {
      return fail("The vendor must mark every item as shipped before you pick up this order.", 409);
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ delivery_status: nextStatus })
    .eq("id", orderId)
    .eq("delivery_agent_id", access.staff.userId)
    .eq("delivery_status", current)
    .select("id, delivery_status")
    .maybeSingle();

  if (updateError) return fail("Could not update delivery status.", 500);
  if (!updated) return fail("This delivery changed. Refresh and try again.", 409);

  return Response.json({ ok: true, delivery: updated });
}
