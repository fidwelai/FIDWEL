// Shared-secret auth for scheduled tasks that call internal endpoints.
//
// Set CRON_SECRET in the environment and give it to whatever runs the schedule.
// Vercel Cron sends it automatically as `Authorization: Bearer <CRON_SECRET>`;
// other schedulers can send the same header or `x-cron-secret`.

export function isCronConfigured(): boolean {
  return (process.env.CRON_SECRET ?? "").trim().length > 0;
}

export function isCronAuthorized(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const headerSecret = (request.headers.get("x-cron-secret") ?? "").trim();

  return bearer === secret || headerSecret === secret;
}

export function cronUnavailable() {
  return Response.json(
    { error: "Scheduled tasks are not configured yet." },
    { status: 503 }
  );
}

export function cronUnauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
