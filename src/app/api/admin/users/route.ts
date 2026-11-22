import { json, rejectCrossOrigin } from "@/lib/http";
import { createUser, listUsers, resetPassword, updateUser, type LocalMember } from "@/lib/auth-local";
import { isAppAccess, type AppAccess } from "@/lib/access";
import type { Role } from "@/lib/membership";
import { authMode, isResponse, requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

const ROLES = new Set<Role>(["admin", "manager", "staff"]);

async function requireAdmin(request: Request): Promise<LocalMember | Response> {
  if (authMode() !== "local") return json({ error: "People sign in through the host in this mode." }, 404);
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  if (member.role !== "admin") return json({ error: "Only an administrator can manage sign-ins." }, 403);
  return member as LocalMember;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  return json({ users: await listUsers(admin.stage) });
}

/**
 * Administrator user management: create (returns a one-time temporary password), update role / pages (app access) / name,
 * switch off or on, and reset a password (returns a new temporary password and signs the person out everywhere).
 */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  if (body.action === "create") {
    const role = str("role") as Role;
    if (!ROLES.has(role)) return json({ error: "Unknown role." }, 400);
    const result = await createUser(admin.stage, {
      username: str("username"),
      name: str("name"),
      email: str("email"),
      role,
      chatOnly: body.chatOnly === true,
      appAccess: isAppAccess(body.appAccess) ? (body.appAccess as AppAccess) : undefined,
    });
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ ok: true, id: result.id, temporaryPassword: result.password });
  }
  if (body.action === "update") {
    const role = body.role === undefined ? undefined : (str("role") as Role);
    if (role !== undefined && !ROLES.has(role)) return json({ error: "Unknown role." }, 400);
    const error = await updateUser(
      admin.stage,
      str("id"),
      {
        role,
        chatOnly: typeof body.chatOnly === "boolean" ? body.chatOnly : undefined,
        appAccess: isAppAccess(body.appAccess) ? (body.appAccess as AppAccess) : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
        name: body.name === undefined ? undefined : str("name"),
      },
      admin.userId,
    );
    if (error) return json({ error }, 400);
    return json({ ok: true });
  }
  if (body.action === "reset") {
    const result = await resetPassword(admin.stage, str("id"));
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ ok: true, temporaryPassword: result.password });
  }
  return json({ error: "Unknown action." }, 400);
}
