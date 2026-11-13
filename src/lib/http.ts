export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export function rejectCrossOrigin(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return null;
  if (site === "cross-site") return json({ error: "Cross-origin request refused." }, 403);
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let originHost = "";
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return json({ error: "Cross-origin request refused." }, 403);
  }
  if (!allowedHosts(request).has(originHost)) return json({ error: "Cross-origin request refused." }, 403);
  return null;
}

function allowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const host = part.trim().replace(/^"|"$/g, "").toLowerCase();
      if (host) hosts.add(host);
    }
  };
  add(request.headers.get("host"));
  add(request.headers.get("x-forwarded-host"));
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    for (const match of forwarded.matchAll(/host=([^;,\s]+)/gi)) add(match[1]);
  }
  try {
    add(new URL(request.url).host);
  } catch {
    // The request URL is only an extra hint.
  }
  return hosts;
}

export function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}
