import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { ensureSeed } from "@/lib/seed";
import { memberFromIdentity, type Member } from "@/lib/members";
import { json } from "@/lib/http";
import { apiAllowed } from "@/lib/access";
import { appStage, memberFromSession, readSessionToken, SESSION_COOKIE, type LocalMember } from "@/lib/auth-local";

/**
 * Two sign-in modes:
 *  - "grok" (default): the Grok Bot / Cursor app host signs people in and sends a signed identity header.
 *  - "local" (AUTH_MODE=local, used on Cloudflare): Mandara's own usernames, passwords and session cookies.
 */
export function authMode(): "local" | "grok" {
  return process.env.AUTH_MODE?.trim() === "local" ? "local" : "grok";
}

/**
 * Get the current signed-in member.
 *
 * IMPORTANT: This function is cached per-request using React's cache().
 * Multiple calls within the same request (e.g. from layout + page) will
 * only execute once and return the same result. This prevents issues with
 * Next.js 15's headers() function being called multiple times.
 */
export const currentMember = cache(async (): Promise<Member | null> => {
  if (authMode() === "local") {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value ?? "";
    if (!token) return null;
    const stage = appStage();
    await ensureSeed(stage);
    return memberFromSession(stage, readSessionToken(`${SESSION_COOKIE}=${token}`));
  }
  const headerList = await headers();
  const identity = await getIdentity(headerList);
  if (!identity.verified || identity.kind !== "person") return null;
  await ensureSeed(identity.stage);
  return memberFromIdentity(identity);
});

export async function requireMember(request: Request): Promise<Member | Response> {
  const member = authMode() === "local" ? await requireLocal(request) : await requireGrok(request);
  if (member instanceof Response) return member;
  let path = "/";
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = "/";
  }
  if (!apiAllowed(member, path)) return json({ error: "Your access is limited to Chat." }, 403);
  return member;
}

async function requireLocal(request: Request): Promise<LocalMember | Response> {
  const stage = appStage();
  const token = readSessionToken(request.headers.get("cookie"));
  if (!token) return json({ error: "Sign in to use Mandara AI." }, 401);
  await ensureSeed(stage);
  const member = await memberFromSession(stage, token);
  if (!member) return json({ error: "Sign in to use Mandara AI." }, 401);
  if (member.mustChangePassword) return json({ error: "Choose a new password first." }, 403);
  return member;
}

async function requireGrok(request: Request): Promise<Member | Response> {
  const identity = await getIdentity(request);
  if (!identity.verified) return json({ error: "Sign in to use Mandara AI." }, 401);
  if (identity.kind !== "person") return json({ error: "This action is for a signed-in person." }, 403);
  if (!identity.emailVerified && !identity.simulated) {
    return json({ error: "Verify your email address to use Mandara AI." }, 403);
  }
  await ensureSeed(identity.stage);
  const member = await memberFromIdentity(identity);
  if (!member) return json({ error: "Sign in to use Mandara AI." }, 401);
  return member;
}

export function isResponse(value: Member | Response): value is Response {
  return value instanceof Response;
}
