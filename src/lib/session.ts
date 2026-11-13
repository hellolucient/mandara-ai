import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { ensureSeed } from "@/lib/seed";
import { memberFromIdentity, type Member } from "@/lib/members";
import { json } from "@/lib/http";

export async function currentMember(): Promise<Member | null> {
  const headerList = await headers();
  const identity = await getIdentity(headerList);
  if (!identity.verified || identity.kind !== "person") return null;
  await ensureSeed(identity.stage);
  return memberFromIdentity(identity);
}

export async function requireMember(request: Request): Promise<Member | Response> {
  const identity = await getIdentity(request);
  if (!identity.verified) return json({ error: "Sign in to use Mandara AI." }, 401);
  if (identity.kind !== "person") return json({ error: "This action is for a signed-in person." }, 403);
  await ensureSeed(identity.stage);
  const member = await memberFromIdentity(identity);
  if (!member) return json({ error: "Sign in to use Mandara AI." }, 401);
  return member;
}

export function isResponse(value: Member | Response): value is Response {
  return value instanceof Response;
}
