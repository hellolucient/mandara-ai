import { json, rejectCrossOrigin } from "@/lib/http";
import { appStage, changeOwnPassword, memberFromSession, readSessionToken } from "@/lib/auth-local";
import { authMode } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The signed-in person changes their own password. Works while a change is still required. */
export async function POST(request: Request) {
  if (authMode() !== "local") return json({ error: "Passwords are handled by the host." }, 404);
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const token = readSessionToken(request.headers.get("cookie"));
  const member = token ? await memberFromSession(appStage(), token) : null;
  if (!member) return json({ error: "Sign in again." }, 401);
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Send the current and new password." }, 400);
  }
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  const error = await changeOwnPassword(member.userId, current, next, token);
  if (error) return json({ error }, 400);
  return json({ ok: true });
}
