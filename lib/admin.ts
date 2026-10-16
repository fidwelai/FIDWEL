import { supabaseAdmin } from "@/lib/supabase-admin";

export type StaffContext = {
  userId: string;
  email: string;
};

export type StaffResult =
  | { status: "unavailable" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "ok"; staff: StaffContext };

function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails(): string[] {
  return parseAllowlist(process.env.ADMIN_EMAILS);
}

export function agentEmails(): string[] {
  return parseAllowlist(process.env.AGENT_EMAILS);
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function authenticate(request: Request): Promise<StaffContext | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const token = bearerToken(request);

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return {
    userId: data.user.id,
    email: (data.user.email ?? "").toLowerCase(),
  };
}

async function currentRole(userId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role ?? null;
}

async function promote(userId: string, role: string): Promise<void> {
  if (!supabaseAdmin) {
    return;
  }

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, role }, { onConflict: "id" });
}

export async function resolveAdmin(request: Request): Promise<StaffResult> {
  if (!supabaseAdmin) {
    return { status: "unavailable" };
  }

  const user = await authenticate(request);

  if (!user) {
    return { status: "unauthenticated" };
  }

  const role = await currentRole(user.userId);
  const allowlisted = adminEmails().includes(user.email);

  if (!allowlisted && role !== "admin") {
    return { status: "forbidden" };
  }

  if (allowlisted && role !== "admin") {
    await promote(user.userId, "admin");
  }

  return { status: "ok", staff: user };
}

export async function resolveAgent(request: Request): Promise<StaffResult> {
  if (!supabaseAdmin) {
    return { status: "unavailable" };
  }

  const user = await authenticate(request);

  if (!user) {
    return { status: "unauthenticated" };
  }

  const role = await currentRole(user.userId);

  if (role === "admin") {
    return { status: "ok", staff: user };
  }

  const allowlisted = agentEmails().includes(user.email);

  if (!allowlisted && role !== "agent") {
    return { status: "forbidden" };
  }

  if (allowlisted && role !== "agent") {
    await promote(user.userId, "agent");
  }

  return { status: "ok", staff: user };
}

export function staffError(result: StaffResult): Response | null {
  if (result.status === "ok") {
    return null;
  }

  if (result.status === "unavailable") {
    return Response.json({ error: "This tool is unavailable." }, { status: 503 });
  }

  if (result.status === "unauthenticated") {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  return Response.json({ error: "Not authorized." }, { status: 403 });
}
