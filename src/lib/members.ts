import { cache } from "react";
import type { VerifiedIdentity } from "../../cursor/identity";
import { sql } from "@/lib/db";
import { decideMembership, isWorkspaceOwner, type Role } from "@/lib/membership";
import { workspaceOwnerSub } from "@/lib/secrets";

export type { Role };

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
  const trustedEmail = identity.emailVerified ? identity.email.trim().toLowerCase() : "";
  const existing = await sql<MemberRow>(
    "select sub, email, name, role from members where stage = $1 and sub = $2",
    [stage, identity.sub],
  );
  const invited = trustedEmail
    ? await sql<{ role: Role }>("select role from role_invites where stage = $1 and lower(email) = $2", [stage, trustedEmail])
    : [];
  const decision = decideMembership({
    existingRole: existing[0]?.role ?? null,
    invitedRole: invited[0]?.role ?? null,
    emailVerified: trustedEmail !== "",
    simulated: identity.simulated,
    owner: isWorkspaceOwner(identity.sub, workspaceOwnerSub()),
  });
  const email = trustedEmail || existing[0]?.email || "";
  const name = identity.name.trim() || email || "Staff member";

  const unchanged =
    Boolean(existing[0]) &&
    existing[0].email === email &&
    existing[0].name === name &&
    existing[0].role === decision.role;

  if (existing[0]) {
    if (!unchanged) {
      await sql(
        "update members set email = $3, name = $4, role = $5, updated_at = now() where stage = $1 and sub = $2",
        [stage, identity.sub, email, name, decision.role],
      );
    }
  } else {
    await sql(
      "insert into members (stage, sub, email, name, role) values ($1, $2, $3, $4, $5) on conflict (stage, sub) do nothing",
      [stage, identity.sub, email, name, decision.role],
    );
  }

  if (decision.consumeInvite && trustedEmail) {
    await sql("delete from role_invites where stage = $1 and lower(email) = $2", [stage, trustedEmail]);
  }

  if (unchanged) {
    return {
      stage,
      sub: identity.sub,
      email,
      name,
      role: decision.role,
      simulated: identity.simulated,
    };
  }

  const stored = await sql<MemberRow>(
    "select sub, email, name, role from members where stage = $1 and sub = $2",
    [stage, identity.sub],
  );
  if (!stored[0]) return null;
  return {
    stage,
    sub: identity.sub,
    email: stored[0].email,
    name: stored[0].name,
    role: stored[0].role,
    simulated: identity.simulated,
  };
}

export const hasAdministrator = cache(async (stage: string): Promise<boolean> => {
  const rows = await sql<{ n: number }>(
    "select count(*)::int as n from members where stage = $1 and role = 'admin'",
    [stage],
  );
  return (rows[0]?.n ?? 0) > 0;
});

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
