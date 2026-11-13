export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host");
  if (!host) return json({ error: "The request is missing a host." }, 400);
  try {
    if (new URL(origin).host !== host) return json({ error: "Cross-origin request refused." }, 403);
  } catch {
    return json({ error: "Cross-origin request refused." }, 403);
  }
  return null;
}

export function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}
