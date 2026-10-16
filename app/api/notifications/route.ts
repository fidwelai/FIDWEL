import { supabaseAdmin } from "@/lib/supabase-admin";

type Resolved =
  | { ok: true; userId: string; admin: NonNullable<typeof supabaseAdmin> }
  | { ok: false; response: Response };

async function resolve(request: Request): Promise<Resolved> {
  const admin = supabaseAdmin;

  if (!admin) {
    return {
      ok: false,
      response: Response.json(
        { error: "Notifications are not available right now." },
        { status: 503 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: "Please sign in." }, { status: 401 }),
    };
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  return { ok: true, userId: data.user.id, admin };
}

export async function GET(request: Request) {
  const auth = await resolve(request);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limitParam = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 30;

  let query = auth.admin
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: "Could not load notifications." }, { status: 500 });
  }

  const { count } = await auth.admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .is("read_at", null);

  return Response.json({ notifications: data ?? [], unread: count ?? 0 });
}

export async function PATCH(request: Request) {
  const auth = await resolve(request);

  if (!auth.ok) {
    return auth.response;
  }

  let body: { id?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const markAll = body.all === true;
  const id = typeof body.id === "string" ? body.id : "";

  if (!markAll && !id) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  let query = auth.admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.userId)
    .is("read_at", null);

  if (!markAll) {
    query = query.eq("id", id);
  }

  const { error } = await query;

  if (error) {
    return Response.json({ error: "Could not update notifications." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
