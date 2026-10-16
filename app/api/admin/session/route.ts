import { resolveAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const result = await resolveAdmin(request);
  return Response.json({ isAdmin: result.status === "ok", status: result.status });
}
