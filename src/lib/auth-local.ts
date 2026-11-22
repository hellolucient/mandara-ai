import { appAccessFromFlags, isAppAccess, type AppAccess } from "@/lib/access";
import { sql } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { Member } from "@/lib/members";
import type { Role } from "@/lib/membership";
import {
  dummyHash,
  hashPassword,
  newSessionToken,
  passwordProblem,
  temporaryPassword,
  tokenHash,
  verifyPassword,
} from "@/lib/password";

/** Mandara's own sign-in (AUTH_MODE=local). Passwords are PBKDF2 hashes; sessions are random tokens stored only as SHA-256. */
export const SESSION_DAYS = 30;
export const MAX_FAILED_LOGINS = 8;
export const LOCK_MINUTES = 15;
/** After a temporary-password sign-in, the person can set a new password without re-entering the temporary one, for this long. */
export const TEMP_PASSWORD_CHANGE_MINUTES = 30;
export const SESSION_COOKIE = "__Host-mandara_session";

export function appStage(): "production" | "preview" {
  return process.env.APP_STAGE?.trim() === "preview" ? "preview" : "production";
}

export function sessionCookie(token: string, maxAgeSeconds = SESSION_DAYS * 86400): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const value = rest.join("=").trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : "";
    }
  }
  return "";
}

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameProblem(value: string): string | null {
  const u = normaliseUsername(value);
  if (u.length < 3 || u.length > 60) return "Usernames are 3 to 60 characters.";
  if (!/^[a-z0-9][a-z0-9._@+-]*$/.test(u)) return "Use letters, numbers, dots, dashes or an email address.";
  return null;
}

type UserRow = {
  id: string;
  sub: string;
  username: string;
  email: string;
  password_hash: string;
  must_change_password: boolean;
  disabled: boolean;
  failed_logins: number;
  locked: boolean;
};

export type LoginResult = { ok: true; token: string; mustChangePassword: boolean } | { ok: false; error: string };

const GENERIC = "That username and password did not match.";

export async function login(stageName: string, username: string, password: string): Promise<LoginResult> {
  const u = normaliseUsername(username);
  if (!u || !password || password.length > 200) return { ok: false, error: GENERIC };
  const rows = await sql<UserRow>(
    `select id, sub, username, email, password_hash, must_change_password, disabled, failed_logins,
            (locked_until is not null and locked_until > now()) as locked
     from app_users where stage = $1 and (lower(username) = $2 or (email <> '' and lower(email) = $2))
     order by (lower(username) = $2) desc limit 1`,
    [stageName, u],
  );
  const user = rows[0];
  if (!user) {
    await verifyPassword(password, await dummyHash());
    return { ok: false, error: GENERIC };
  }
  if (user.locked) return { ok: false, error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes or ask an administrator.` };
  const good = await verifyPassword(password, user.password_hash);
  if (!good) {
    await sql(
      `update app_users set failed_logins = failed_logins + 1,
         locked_until = case when failed_logins + 1 >= $2 then now() + ($3 || ' minutes')::interval else locked_until end
       where id = $1`,
      [user.id, MAX_FAILED_LOGINS, String(LOCK_MINUTES)],
    );
    return { ok: false, error: GENERIC };
  }
  if (user.disabled) return { ok: false, error: "This account is switched off. Ask an administrator." };
  await sql("update app_users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1", [user.id]);
  const token = newSessionToken();
  await sql(
    `insert into app_sessions (token_hash, stage, user_id, expires_at, from_temp_password)
     values ($1, $2, $3, now() + ($4 || ' days')::interval, $5)`,
    [await tokenHash(token), stageName, user.id, String(SESSION_DAYS), user.must_change_password],
  );
  // Opportunistic clean-up of expired sessions.
  await sql("delete from app_sessions where expires_at < now()");
  return { ok: true, token, mustChangePassword: user.must_change_password };
}

export async function logout(token: string): Promise<void> {
  if (!token) return;
  await sql("delete from app_sessions where token_hash = $1", [await tokenHash(token)]);
}

type SessionRow = {
  user_id: string;
  sub: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  chat_only: boolean;
  app_access: string;
  spa_location_id: string;
  must_change_password: boolean;
  stale: boolean;
  token_hash: string;
};

export type LocalMember = Member & { userId: string; username: string; mustChangePassword: boolean };

export async function memberFromSession(stageName: string, token: string): Promise<LocalMember | null> {
  if (!token) return null;
  const hash = await tokenHash(token);
  const rows = await sql<SessionRow>(
    `select s.token_hash, u.id as user_id, u.sub, u.username, u.email, m.name, m.role, m.chat_only, m.app_access, m.spa_location_id,
            u.must_change_password, (s.last_seen_at < now() - interval '1 hour') as stale
     from app_sessions s
     join app_users u on u.id = s.user_id
     join members m on m.stage = u.stage and m.sub = u.sub
     where s.token_hash = $1 and s.stage = $2 and s.expires_at > now() and not u.disabled`,
    [hash, stageName],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.stale) await sql("update app_sessions set last_seen_at = now() where token_hash = $1", [hash]);
  return {
    stage: stageName === "preview" ? "preview" : "production",
    sub: row.sub,
    email: row.email,
    name: row.name || row.username,
    role: row.role,
    simulated: false,
    chatOnly: appAccessFromFlags({ appAccess: row.app_access, chatOnly: Boolean(row.chat_only) }) === "chat",
    appAccess: appAccessFromFlags({ appAccess: row.app_access, chatOnly: Boolean(row.chat_only) }),
    spaLocationId: row.spa_location_id || "",
    userId: row.user_id,
    username: row.username,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export type UserListRow = {
  id: string;
  sub: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  chatOnly: boolean;
  appAccess: AppAccess;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export async function listUsers(stageName: string): Promise<UserListRow[]> {
  const rows = await sql<{
    id: string; sub: string; username: string; email: string; name: string; role: Role; chat_only: boolean; app_access: string;
    disabled: boolean; must_change_password: boolean; last_login_at: string | null;
  }>(
    `select u.id, u.sub, u.username, u.email, m.name, m.role, m.chat_only, m.app_access, u.disabled, u.must_change_password,
            to_char(u.last_login_at at time zone 'Asia/Bangkok', 'DD Mon YYYY HH24:MI') as last_login_at
     from app_users u join members m on m.stage = u.stage and m.sub = u.sub
     where u.stage = $1 order by u.created_at`,
    [stageName],
  );
  return rows.map((r) => ({
    id: r.id, sub: r.sub, username: r.username, email: r.email, name: r.name, role: r.role,
    chatOnly: appAccessFromFlags({ appAccess: r.app_access, chatOnly: Boolean(r.chat_only) }) === "chat",
    appAccess: appAccessFromFlags({ appAccess: r.app_access, chatOnly: Boolean(r.chat_only) }),
    disabled: Boolean(r.disabled), mustChangePassword: Boolean(r.must_change_password), lastLoginAt: r.last_login_at,
  }));
}

export type NewUser = { username: string; name: string; email?: string; role: Role; chatOnly?: boolean; appAccess?: AppAccess; sub?: string; password?: string };

/**
 * Creates a person with a temporary password (or the given one) that they must change at first sign-in.
 * `sub` lets an existing member (for example Trent's Grok-era id) keep their chat history and memories.
 */
export async function createUser(stageName: string, input: NewUser): Promise<{ ok: true; id: string; password: string } | { ok: false; error: string }> {
  const username = normaliseUsername(input.username);
  const problem = usernameProblem(username);
  if (problem) return { ok: false, error: problem };
  if (!["admin", "manager", "staff"].includes(input.role)) return { ok: false, error: "Unknown role." };
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email or leave it blank." };
  const taken = await sql("select 1 from app_users where stage = $1 and lower(username) = $2", [stageName, username]);
  if (taken.length) return { ok: false, error: "That username is taken." };
  const password = input.password ?? temporaryPassword();
  const weak = passwordProblem(password, username);
  if (weak) return { ok: false, error: weak };
  const id = newId();
  const sub = input.sub?.trim() || `local:${id}`;
  const linked = await sql("select 1 from app_users where stage = $1 and sub = $2", [stageName, sub]);
  if (linked.length) return { ok: false, error: "That member already has a sign-in." };
  const access = appAccessFromFlags({ appAccess: input.appAccess, chatOnly: input.chatOnly });
  await sql(
    `insert into members (stage, sub, email, name, role, chat_only, app_access) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (stage, sub) do update set email = excluded.email, name = excluded.name, role = excluded.role,
       chat_only = excluded.chat_only, app_access = excluded.app_access, updated_at = now()`,
    [stageName, sub, email, input.name.trim().slice(0, 120) || username, input.role, access === "chat", access],
  );
  await sql(
    `insert into app_users (id, stage, sub, username, email, password_hash, must_change_password) values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, stageName, sub, username, email, await hashPassword(password), input.password === undefined],
  );
  return { ok: true, id, password };
}

export async function updateUser(
  stageName: string,
  id: string,
  change: { role?: Role; chatOnly?: boolean; appAccess?: AppAccess; disabled?: boolean; name?: string },
  actorUserId: string,
): Promise<string | null> {
  const rows = await sql<{ sub: string; role: Role }>(
    "select u.sub, m.role from app_users u join members m on m.stage = u.stage and m.sub = u.sub where u.stage = $1 and u.id = $2",
    [stageName, id],
  );
  const target = rows[0];
  if (!target) return "That person was not found.";
  const demoting = change.role !== undefined && change.role !== "admin" && target.role === "admin";
  const disablingAdmin = change.disabled === true && target.role === "admin";
  if (demoting || disablingAdmin) {
    const admins = await sql<{ n: number }>(
      `select count(*)::int as n from app_users u join members m on m.stage = u.stage and m.sub = u.sub
       where u.stage = $1 and m.role = 'admin' and not u.disabled`,
      [stageName],
    );
    if ((admins[0]?.n ?? 0) <= 1) return "Keep at least one active administrator.";
  }
  if (id === actorUserId && (change.disabled === true || demoting)) return "You cannot switch off or demote your own sign-in.";
  if (change.role !== undefined) {
    if (!["admin", "manager", "staff"].includes(change.role)) return "Unknown role.";
    await sql("update members set role = $3, updated_at = now() where stage = $1 and sub = $2", [stageName, target.sub, change.role]);
  }
  if (change.appAccess !== undefined || change.chatOnly !== undefined) {
    if (change.appAccess !== undefined && !isAppAccess(change.appAccess)) return "Unknown access.";
    const access = appAccessFromFlags({ appAccess: change.appAccess, chatOnly: change.chatOnly });
    await sql(
      "update members set chat_only = $3, app_access = $4, updated_at = now() where stage = $1 and sub = $2",
      [stageName, target.sub, access === "chat", access],
    );
  }
  if (change.name !== undefined && change.name.trim()) {
    await sql("update members set name = $3, updated_at = now() where stage = $1 and sub = $2", [stageName, target.sub, change.name.trim().slice(0, 120)]);
  }
  if (change.disabled !== undefined) {
    await sql("update app_users set disabled = $3, updated_at = now() where stage = $1 and id = $2", [stageName, id, change.disabled]);
    if (change.disabled) await sql("delete from app_sessions where user_id = $1", [id]);
  }
  return null;
}

/** Administrator reset: a new temporary password, all sessions signed out, change required at next sign-in. */
export async function resetPassword(stageName: string, id: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const rows = await sql<{ username: string }>("select username from app_users where stage = $1 and id = $2", [stageName, id]);
  if (!rows[0]) return { ok: false, error: "That person was not found." };
  const password = temporaryPassword();
  await sql(
    `update app_users set password_hash = $3, must_change_password = true, failed_logins = 0, locked_until = null,
       password_changed_at = now(), updated_at = now() where stage = $1 and id = $2`,
    [stageName, id, await hashPassword(password)],
  );
  await sql("delete from app_sessions where user_id = $1", [id]);
  return { ok: true, password };
}

/** The signed-in person changes their own password. Other sessions are signed out; this one stays. */
export async function changeOwnPassword(
  userId: string,
  current: string,
  next: string,
  keepToken: string,
): Promise<string | null> {
  const rows = await sql<{ username: string; password_hash: string; must_change_password: boolean }>(
    "select username, password_hash, must_change_password from app_users where id = $1",
    [userId],
  );
  const user = rows[0];
  if (!user) return "Sign in again.";
  const hash = await tokenHash(keepToken);
  const sessions = await sql<{ from_temp_password: boolean; fresh: boolean }>(
    `select from_temp_password, (created_at > now() - ($2 || ' minutes')::interval) as fresh
     from app_sessions where token_hash = $1 and user_id = $3`,
    [hash, String(TEMP_PASSWORD_CHANGE_MINUTES), userId],
  );
  const session = sessions[0];
  const skipCurrent = Boolean(user.must_change_password && session?.from_temp_password && session?.fresh);
  if (!skipCurrent) {
    if (user.must_change_password && session?.from_temp_password && session && !session.fresh) {
      return "That sign-in has expired. Sign in again to choose a new password.";
    }
    if (!current) return "Enter your current password.";
    if (!(await verifyPassword(current, user.password_hash))) return "Your current password was not right.";
  }
  const weak = passwordProblem(next, user.username);
  if (weak) return weak;
  if (await verifyPassword(next, user.password_hash)) return "Choose a new password, not the current one.";
  await sql(
    "update app_users set password_hash = $2, must_change_password = false, password_changed_at = now(), updated_at = now() where id = $1",
    [userId, await hashPassword(next)],
  );
  await sql("delete from app_sessions where user_id = $1 and token_hash <> $2", [userId, hash]);
  return null;
}
