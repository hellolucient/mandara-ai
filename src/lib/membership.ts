import { timingSafeEqual } from "node:crypto";

export type Role = "admin" | "manager" | "staff";

export type MembershipDecision = {
  role: Role;
  consumeInvite: boolean;
};

/**
 * Administrator is never implied by being first.
 * It is granted to the configured workspace owner, to the local simulated viewer,
 * or to a verified-email invite. An unverified email cannot claim an invite.
 * Owner bootstrap requires email verification, except for simulated viewers in dev mode.
 */
export function decideMembership(input: {
  existingRole: Role | null;
  invitedRole: Role | null;
  emailVerified: boolean;
  simulated: boolean;
  owner: boolean;
}): MembershipDecision {
  const invite = input.emailVerified ? input.invitedRole : null;
  if (input.simulated) {
    return { role: "admin", consumeInvite: invite !== null };
  }
  if (input.owner && input.emailVerified) {
    return { role: "admin", consumeInvite: invite !== null };
  }
  if (invite) return { role: invite, consumeInvite: true };
  if (input.existingRole) return { role: input.existingRole, consumeInvite: false };
  return { role: "staff", consumeInvite: false };
}

export function isWorkspaceOwner(sub: string, configured: string | undefined): boolean {
  const owner = configured?.trim() ?? "";
  const id = sub.trim();
  if (!owner || !id) return false;
  if (sameSecret(id, owner)) return true;
  return sameSecret(id, `user:${owner}`);
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
