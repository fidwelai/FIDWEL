import { resolveAgent } from "@/lib/admin";

export async function GET(request: Request) {
  const result = await resolveAgent(request);
  return Response.json({ isAgent: result.status === "ok", status: result.status });
}
