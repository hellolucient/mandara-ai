import { json, rejectCrossOrigin } from "@/lib/http";
import { appStage, login, sessionCookie } from "@/lib/auth-local";
import { ensureSeed } from "@/lib/seed";
import { safeNext } from "@/lib/safe-next";
import { authMode } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (authMode() !== "local") return json({ error: "Sign-in is handled by the host." }, 404);
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Send a username and password." }, 400);
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const stage = appStage();
  await ensureSeed(stage);
  const result = await login(stage, username, password);
  if (!result.ok) return json({ error: result.error }, 401);
  const next = result.mustChangePassword ? "/account/password" : safeNext(body.next);
  return Response.json(
    { ok: true, next },
    { headers: { "set-cookie": sessionCookie(result.token), "cache-control": "private, no-store" } },
  );
}
