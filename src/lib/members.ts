import { sql } from "@/lib/db";
import type { VerifiedIdentity } from "../../cursor/identity";

export type Role = "admin" | "manager" | "staff";

export type Member = {
  stage: "production" | "preview";
  sub: string;
  email: string;
  name: string;
  role: Role;
  simulated: boolean;
};

type MemberRow = { sub: string; email: string; name: string; role: Role };

export async function memberFromIdentity(identity: VerifiedIdentity): Promise<Member | null> {
  if (identity.kind !== "person") return null;
  const stage = identity.stage;
  const email = identity.email.trim().toLowerCase();
  const name = identity.name.trim() || email || "Staff member";
  
  // Check if member already exists (by sub, which is the stable user ID)
  const existing = await sql<MemberRow>(
    "select sub, email, name, role from members where stage = $1 and sub = $2",
    [stage, identity.sub],
  );
  
  if (existing[0]) {
    // Member exists - update their email/name in case it changed
    await sql(
      "update members set email = $3, name = $4, updated_at = now() where stage = $1 and sub = $2",
      [stage, identity.sub, email, name],
    );
    return { stage, sub: identity.sub, email, name, role: existing[0].role, simulated: identity.simulated };
  }
  
  // New member - check for invitation (case-insensitive email match)
  const invited = email
    ? await sql<{ role: Role }>(
        "select role from role_invites where stage = $1 and lower(email) = $2",
        [stage, email]
      )
    : [];
  
  // Determine role: invited role, or admin if first member, otherwise staff
  const count = await sql<{ n: number }>("select count(*)::int as n from members where stage = $1", [stage]);
  const role = invited[0]?.role ?? (Number(count[0]?.n ?? 0) === 0 ? "admin" : "staff");
  
  // Create new member
  await sql(
    "insert into members (stage, sub, email, name, role) values ($1, $2, $3, $4, $5) on conflict (stage, sub) do nothing",
    [stage, identity.sub, email, name, role],
  );
  
  // Clean up used invitation (case-insensitive)
  if (email) {
    await sql("delete from role_invites where stage = $1 and lower(email) = $2", [stage, email]);
  }
  
  // Fetch the stored member to get their final state
  const stored = await sql<MemberRow>(
    "select sub, email, name, role from members where stage = $1 and sub = $2",
    [stage, identity.sub],
  );
  
  if (!stored[0]) {
    // This should never happen due to the insert above, but handle it gracefully
    console.error("mandara: member creation succeeded but fetch failed for sub:", identity.sub);
    return null;
  }
  
  return {
    stage,
    sub: identity.sub,
    email: stored[0].email,
    name: stored[0].name,
    role: stored[0].role,
    simulated: identity.simulated,
  };
}

export async function listMembers(stage: string): Promise<MemberRow[]> {
  return sql<MemberRow>(
    "select sub, email, name, role from members where stage = $1 order by created_at",
    [stage],
  );
}

export async function listInvites(stage: string): Promise<Array<{ email: string; role: Role }>> {
  return sql("select email, role from role_invites where stage = $1 order by email", [stage]);
}

export async function setMemberRole(stage: string, sub: string, role: Role, actorSub: string): Promise<string | null> {
  if (sub === actorSub && role !== "admin") {
    const admins = await sql<{ n: number }>(
      "select count(*)::int as n from members where stage = $1 and role = 'admin'",
      [stage],
    );
    if ((admins[0]?.n ?? 0) <= 1) return "The only administrator cannot leave that role.";
  }
  const updated = await sql("update members set role = $3, updated_at = now() where stage = $1 and sub = $2 returning sub", [
    stage,
    sub,
    role,
  ]);
  return updated.length ? null : "That person is not in this workspace yet.";
}

export async function saveInvite(stage: string, email: string, role: Role): Promise<void> {
  await sql(
    `insert into role_invites (stage, email, role) values ($1, $2, $3)
     on conflict (stage, email) do update set role = excluded.role`,
    [stage, email, role],
  );
}

export function canManage(role: Role): boolean {
  return role === "admin" || role === "manager";
}
