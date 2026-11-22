import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { apiAllowed, canSeeContracts, pageAllowed, roleLabel } from "./access";
import {
  changeOwnPassword,
  clearedSessionCookie,
  createUser,
  deleteUser,
  listUsers,
  login,
  logout,
  MAX_FAILED_LOGINS,
  memberFromSession,
  readSessionToken,
  resetPassword,
  sessionCookie,
  SESSION_COOKIE,
  updateUser,
} from "./auth-local";
import { companyPrompt } from "./company-profile";
import { hashPassword, passwordProblem, PBKDF2_ITERATIONS, temporaryPassword, verifyPassword } from "./password";
import { navItems } from "./nav";
import { safeNext } from "./safe-next";
import { sql } from "./db";

describe("auth: password hashing", () => {
  it("hashes with PBKDF2-SHA256 at the Workers maximum and verifies", async () => {
    const hash = await hashPassword("coral-reef-sunrise");
    assert.match(hash, new RegExp(`^pbkdf2-sha256\\$${PBKDF2_ITERATIONS}\\$[A-Za-z0-9_-]+\\$[A-Za-z0-9_-]{43}$`));
    assert.equal(await verifyPassword("coral-reef-sunrise", hash), true);
    assert.equal(await verifyPassword("coral-reef-sunrisE", hash), false);
  });
  it("salts every hash and rejects malformed or over-limit hashes", async () => {
    assert.notEqual(await hashPassword("same-password-1"), await hashPassword("same-password-1"));
    assert.equal(await verifyPassword("x", "plain"), false);
    assert.equal(await verifyPassword("x", "pbkdf2-sha256$999999$AAAA$AAAA"), false);
  });
  it("enforces a minimum length and no username inside", () => {
    assert.ok(passwordProblem("short"));
    assert.ok(passwordProblem("tenille-is-great", "tenille"));
    assert.equal(passwordProblem("lagoon breeze at dawn", "tenille"), null);
    assert.equal(passwordProblem(temporaryPassword()), null);
  });
});

describe("auth: cookies and redirects", () => {
  it("sets an HttpOnly, Secure, SameSite=Lax host-only cookie", () => {
    const cookie = sessionCookie("abcdefghijklmnopqrstuvwxyz012345");
    assert.ok(cookie.startsWith(`${SESSION_COOKIE}=`));
    for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(flag), flag);
    assert.ok(!/Domain=/i.test(cookie));
    assert.ok(clearedSessionCookie().includes("Max-Age=0"));
  });
  it("reads only a well-formed session token", () => {
    assert.equal(readSessionToken(`a=1; ${SESSION_COOKIE}=abcdefghijklmnopqrstuvwxyz012345; b=2`), "abcdefghijklmnopqrstuvwxyz012345");
    assert.equal(readSessionToken(`${SESSION_COOKIE}=bad token;`), "");
    assert.equal(readSessionToken(null), "");
  });
  it("only follows same-site paths after sign-in", () => {
    assert.equal(safeNext("/chat/abc"), "/chat/abc");
    assert.equal(safeNext("//evil.example"), "/");
    assert.equal(safeNext("https://evil.example"), "/");
    assert.equal(safeNext("/\\evil.example"), "/");
    assert.equal(safeNext("/login"), "/");
    assert.equal(safeNext(undefined), "/");
  });
});

describe("auth: access levels", () => {
  it("labels roles as Admin, Management and Spa", () => {
    assert.equal(roleLabel("admin"), "Admin");
    assert.equal(roleLabel("manager"), "Management");
    assert.equal(roleLabel("staff"), "Spa");
  });
  it("shows contracts to Admin and Management only", () => {
    assert.equal(canSeeContracts("admin"), true);
    assert.equal(canSeeContracts("manager"), true);
    assert.equal(canSeeContracts("staff"), false);
    const profile = { description: "", spas: [], people: [], contacts: [], keywords: [], adminNotes: "", contracts: [{ name: "Hakuraa Huraa", partner: "Owner Pvt Ltd", status: "signed" }] };
    assert.match(companyPrompt(profile, [], { includeContracts: true }), /Hotel partner contracts/);
    assert.doesNotMatch(companyPrompt(profile, [], { includeContracts: false }), /Hotel partner contracts|Owner Pvt Ltd/);
  });
  it("keeps chat-only people in Chat, pages and APIs alike", () => {
    const tenille = { role: "manager", chatOnly: true };
    assert.equal(pageAllowed(tenille, "/chat"), true);
    assert.equal(pageAllowed(tenille, "/chat/abc123"), true);
    assert.equal(pageAllowed(tenille, "/"), false);
    assert.equal(pageAllowed(tenille, "/sales"), false);
    assert.equal(pageAllowed(tenille, "/print/sales"), false);
    assert.equal(apiAllowed(tenille, "/api/chat"), true);
    assert.equal(apiAllowed(tenille, "/api/conversations/x"), true);
    assert.equal(apiAllowed(tenille, "/api/sales/import"), false);
    assert.equal(apiAllowed(tenille, "/api/knowledge"), false);
    assert.equal(apiAllowed(tenille, "/api/prospects"), false);
    assert.equal(apiAllowed(tenille, "/api/admin/export"), false);
    assert.deepEqual(navItems("manager", true).map((item) => item.href), ["/chat"]);
    // An administrator is never locked out by the switch.
    assert.equal(pageAllowed({ role: "admin", chatOnly: true }, "/admin"), true);
  });
});

describe("auth: sign-in, sessions and administration (local database)", () => {
  const stage = `auth-test-${Date.now()}`;

  it("creates a person with a temporary password that must be changed", async () => {
    const made = await createUser(stage, { username: "Trent", name: "Trent", role: "admin", chatOnly: false, password: "owner-password-long" });
    assert.ok(made.ok);
    const temp = await createUser(stage, { username: "tenille", name: "Tenille", email: "tenille@example.com", role: "manager", chatOnly: true });
    assert.ok(temp.ok);
    if (!temp.ok) return;
    assert.equal((await createUser(stage, { username: "TENILLE", name: "x", role: "staff", chatOnly: false })).ok, false, "usernames are case-insensitive and unique");
    const signedIn = await login(stage, "Tenille@Example.com", temp.password);
    assert.ok(signedIn.ok, "email works as a username");
    if (!signedIn.ok) return;
    assert.equal(signedIn.mustChangePassword, true);
    const member = await memberFromSession(stage, signedIn.token);
    assert.equal(member?.role, "manager");
    assert.equal(member?.chatOnly, true);
    assert.equal(member?.appAccess, "chat");
    assert.equal(member?.mustChangePassword, true);
    assert.equal(await changeOwnPassword(member!.userId, "", "a-new-long-password", signedIn.token), null);
    assert.equal((await memberFromSession(stage, signedIn.token))?.mustChangePassword, false);
    assert.equal((await login(stage, "tenille", temp.password)).ok, false, "the temporary password stops working");
  });

  it("skips the current password only for a fresh temporary-password sign-in", async () => {
    const made = await createUser(stage, { username: "demo-pw", name: "Demo", role: "staff", chatOnly: true });
    assert.ok(made.ok);
    if (!made.ok) return;
    const first = await login(stage, "demo-pw", made.password);
    assert.ok(first.ok && first.mustChangePassword);
    if (!first.ok) return;
    const member = await memberFromSession(stage, first.token);
    assert.ok(member);
    assert.equal(await changeOwnPassword(member.userId, "wrong-guess", "first-own-password", first.token), null, "the session is proof; a guessed current password is ignored");
    const voluntary = await login(stage, "demo-pw", "first-own-password");
    assert.ok(voluntary.ok && !voluntary.mustChangePassword);
    if (!voluntary.ok) return;
    const again = await memberFromSession(stage, voluntary.token);
    assert.ok(again);
    assert.equal(await changeOwnPassword(again.userId, "", "second-own-password", voluntary.token), "Enter your current password.");
    assert.equal(await changeOwnPassword(again.userId, "wrong-guess", "second-own-password", voluntary.token), "Your current password was not right.");
    assert.equal(await changeOwnPassword(again.userId, "first-own-password", "second-own-password", voluntary.token), null);

    const reset = await resetPassword(stage, made.id);
    assert.ok(reset.ok);
    if (!reset.ok) return;
    const stale = await login(stage, "demo-pw", reset.password);
    assert.ok(stale.ok);
    if (!stale.ok) return;
    const waiting = await memberFromSession(stage, stale.token);
    assert.ok(waiting);
    await sql("update app_sessions set created_at = now() - interval '2 hours' where user_id = $1", [waiting.userId]);
    assert.equal(await changeOwnPassword(waiting.userId, "", "after-expiry-password", stale.token), "That sign-in has expired. Sign in again to choose a new password.");
  });

  it("does not show a temporary-password field on the forced first-sign-in form", () => {
    const form = readFileSync("src/components/auth/login-form.tsx", "utf8");
    assert.match(form, /required \? "" : form\.get\("current"\)/);
    assert.match(form, /\{!required \? \(/);
    assert.doesNotMatch(form, /required \? "Temporary password"/);
    const page = readFileSync("src/app/account/password/page.tsx", "utf8");
    assert.match(page, /Choose your own password to finish signing in/);
  });

  it("stores only a hash of the session token and signs out", async () => {
    const result = await login(stage, "trent", "owner-password-long");
    assert.ok(result.ok);
    if (!result.ok) return;
    const raw = await sql<{ n: number }>("select count(*)::int as n from app_sessions where token_hash = $1", [result.token]);
    assert.equal(raw[0].n, 0);
    assert.ok(await memberFromSession(stage, result.token));
    await logout(result.token);
    assert.equal(await memberFromSession(stage, result.token), null);
    assert.equal(await memberFromSession(stage, "not-a-real-token-at-all-xxxxxxxx"), null);
  });

  it("gives the same answer for an unknown user and a wrong password, and locks after repeated failures", async () => {
    const unknown = await login(stage, "nobody", "whatever-password");
    const wrong = await login(stage, "trent", "whatever-password");
    assert.ok(!unknown.ok && !wrong.ok);
    if (unknown.ok || wrong.ok) return;
    assert.equal(unknown.error, wrong.error);
    await createUser(stage, { username: "locktest", name: "Lock", role: "staff", chatOnly: false, password: "correct-horse-battery" });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await login(stage, "locktest", "nope-nope-nope");
    const locked = await login(stage, "locktest", "correct-horse-battery");
    assert.equal(locked.ok, false);
    if (!locked.ok) assert.match(locked.error, /Too many attempts/);
  });

  it("lets an administrator reset, switch off and change access, and keeps one admin", async () => {
    const users = await listUsers(stage);
    const trent = users.find((u) => u.username === "trent")!;
    const tenille = users.find((u) => u.username === "tenille")!;
    const session = await login(stage, "tenille", "a-new-long-password");
    assert.ok(session.ok);
    const reset = await resetPassword(stage, tenille.id);
    assert.ok(reset.ok);
    if (session.ok) assert.equal(await memberFromSession(stage, session.token), null, "a reset signs them out");
    if (!reset.ok) return;
    const again = await login(stage, "tenille", reset.password);
    assert.ok(again.ok && again.mustChangePassword);
    assert.equal(await updateUser(stage, tenille.id, { role: "staff", chatOnly: false }, trent.id), null);
    if (again.ok) {
      const m = await memberFromSession(stage, again.token);
      assert.equal(m?.role, "staff");
      assert.equal(m?.chatOnly, false);
      assert.equal(m?.appAccess, "full");
    }
    assert.equal(await updateUser(stage, tenille.id, { disabled: true }, trent.id), null);
    if (again.ok) assert.equal(await memberFromSession(stage, again.token), null, "switching off ends sessions");
    assert.equal((await login(stage, "tenille", reset.password)).ok, false);
    assert.ok(await updateUser(stage, trent.id, { role: "manager" }, trent.id), "the only admin cannot be demoted");
  });

  it("creates and updates Dashboard + chat access and keeps chat-only people on chat", async () => {
    const made = await createUser(stage, { username: "dash-test", name: "Dash", role: "manager", appAccess: "dashboard", password: "dashboard-test-password" });
    assert.ok(made.ok);
    if (!made.ok) return;
    const signedIn = await login(stage, "dash-test", "dashboard-test-password");
    assert.ok(signedIn.ok);
    if (!signedIn.ok) return;
    const member = await memberFromSession(stage, signedIn.token);
    assert.equal(member?.appAccess, "dashboard");
    assert.equal(member?.chatOnly, false);
    const users = await listUsers(stage);
    const trent = users.find((u) => u.username === "trent")!;
    assert.equal(await updateUser(stage, made.id, { appAccess: "chat" }, trent.id), null);
    assert.equal((await memberFromSession(stage, signedIn.token))?.appAccess, "chat");
    assert.equal((await memberFromSession(stage, signedIn.token))?.chatOnly, true);
    assert.equal(await updateUser(stage, made.id, { appAccess: "dashboard" }, trent.id), null);
    const again = await memberFromSession(stage, signedIn.token);
    assert.equal(again?.appAccess, "dashboard");
    assert.equal(again?.chatOnly, false);
    const listed = (await listUsers(stage)).find((u) => u.username === "dash-test");
    assert.equal(listed?.appAccess, "dashboard");
  });

  it("puts a Delete confirm in People and only administrators can call the API", () => {
    const people = readFileSync("src/components/users-manager.tsx", "utf8");
    assert.match(people, /Delete \{pendingDelete/);
    assert.match(people, /Their sign-in and chats will be removed/);
    assert.match(people, /setPendingDelete\(user\)/);
    assert.doesNotMatch(people, /window\.confirm/);
    assert.match(people, /user\.id !== selfId/);
    const route = readFileSync("src/app/api/admin/users/route.ts", "utf8");
    assert.match(route, /body\.action === "delete"/);
    assert.match(route, /deleteUser\(admin\.stage, str\("id"\), admin\.userId\)/);
    assert.ok(route.indexOf("requireAdmin") < route.indexOf('body.action === "delete"'));
    assert.match(route, /Only an administrator can manage sign-ins/);
  });

  it("deletes a person and their chats, refuses deleting yourself or the last admin, and frees the username", async () => {
    const users = await listUsers(stage);
    const trent = users.find((u) => u.username === "trent")!;
    assert.equal(await deleteUser(stage, trent.id, trent.id), "You cannot delete your own sign-in.");
    assert.equal(await deleteUser(stage, trent.id, "not-the-admin-id"), "Keep at least one administrator.");
    assert.ok((await listUsers(stage)).some((u) => u.username === "trent"));

    const made = await createUser(stage, { username: "tmp-delete", name: "Tmp Delete", role: "manager", appAccess: "chat", password: "delete-me-please-now" });
    assert.ok(made.ok);
    if (!made.ok) return;
    const signedIn = await login(stage, "tmp-delete", "delete-me-please-now");
    assert.ok(signedIn.ok);
    if (!signedIn.ok) return;
    const member = await memberFromSession(stage, signedIn.token);
    assert.ok(member);
    await sql("insert into conversations (id, stage, owner_sub, title) values ($1, $2, $3, 'A private chat')", [`c-del-${stage}`, stage, member.sub]);
    await sql("insert into user_memories (id, stage, user_sub, content) values ($1, $2, $3, 'A private memory')", [`m-del-${stage}`, stage, member.sub]);
    await sql("insert into conversations (id, stage, owner_sub, title) values ($1, $2, 'other-sub', 'Someone else')", [`c-keep-${stage}`, stage]);

    assert.equal(await deleteUser(stage, made.id, trent.id), null);
    assert.equal(await memberFromSession(stage, signedIn.token), null);
    assert.equal((await listUsers(stage)).some((u) => u.username === "tmp-delete"), false);
    assert.equal((await sql("select 1 from conversations where stage = $1 and owner_sub = $2", [stage, member.sub])).length, 0);
    assert.equal((await sql("select 1 from user_memories where stage = $1 and user_sub = $2", [stage, member.sub])).length, 0);
    assert.equal((await sql("select 1 from conversations where id = $1", [`c-keep-${stage}`])).length, 1);
    assert.equal((await sql("select 1 from members where stage = $1 and sub = $2", [stage, member.sub])).length, 0);
    assert.equal(await deleteUser(stage, made.id, trent.id), "That person was not found.");

    const again = await createUser(stage, { username: "tmp-delete", name: "Tmp Delete Again", role: "staff", chatOnly: false, password: "reused-username-ok-1" });
    assert.ok(again.ok, "the username can be used again");
    if (!again.ok) return;
    const loginAgain = await login(stage, "tmp-delete", "reused-username-ok-1");
    assert.ok(loginAgain.ok);
    if (!loginAgain.ok) return;
    const fresh = await memberFromSession(stage, loginAgain.token);
    assert.equal(fresh?.name, "Tmp Delete Again");
    assert.equal((await sql("select 1 from conversations where stage = $1 and owner_sub = $2", [stage, fresh!.sub])).length, 0);

    const second = await createUser(stage, { username: "admin-two", name: "Admin Two", role: "admin", chatOnly: false, password: "second-admin-password" });
    assert.ok(second.ok);
    if (!second.ok) return;
    assert.equal(await deleteUser(stage, second.id, trent.id), null);
    assert.equal(await deleteUser(stage, trent.id, second.id), "Keep at least one administrator.");
  });

  it("can link a sign-in to an existing member so chat history carries over", async () => {
    await sql("insert into members (stage, sub, email, name, role) values ($1, 'user:42', 'old@example.com', 'Old', 'admin')", [stage]);
    await sql("insert into conversations (id, stage, owner_sub, title) values ($1, $2, 'user:42', 'Earlier chat')", [`c-${stage}`, stage]);
    const made = await createUser(stage, { username: "linked", name: "Linked", role: "admin", chatOnly: false, sub: "user:42", password: "history-carries-over" });
    assert.ok(made.ok);
    const s = await login(stage, "linked", "history-carries-over");
    assert.ok(s.ok);
    if (!s.ok) return;
    const m = await memberFromSession(stage, s.token);
    assert.equal(m?.sub, "user:42");
    const chats = await sql("select 1 from conversations where stage = $1 and owner_sub = $2", [stage, m!.sub]);
    assert.equal(chats.length, 1);
  });
});
