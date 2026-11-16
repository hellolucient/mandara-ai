import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideMembership, isWorkspaceOwner } from "./membership.js";

describe("decideMembership", () => {
  it("does not make the first person an administrator", () => {
    const decision = decideMembership({
      existingRole: null,
      invitedRole: null,
      emailVerified: true,
      simulated: false,
      owner: false,
    });
    assert.deepEqual(decision, { role: "staff", consumeInvite: false });
  });

  it("makes the configured owner an administrator", () => {
    const decision = decideMembership({
      existingRole: null,
      invitedRole: "staff",
      emailVerified: true,
      simulated: false,
      owner: true,
    });
    assert.equal(decision.role, "admin");
    assert.equal(decision.consumeInvite, true);
  });

  it("keeps an invited role only when the email is verified", () => {
    const verified = decideMembership({
      existingRole: null,
      invitedRole: "manager",
      emailVerified: true,
      simulated: false,
      owner: false,
    });
    assert.deepEqual(verified, { role: "manager", consumeInvite: true });

    const unverified = decideMembership({
      existingRole: null,
      invitedRole: "admin",
      emailVerified: false,
      simulated: false,
      owner: false,
    });
    assert.deepEqual(unverified, { role: "staff", consumeInvite: false });
  });

  it("does not let an unverified email replace a role already stored", () => {
    const decision = decideMembership({
      existingRole: "staff",
      invitedRole: "admin",
      emailVerified: false,
      simulated: false,
      owner: false,
    });
    assert.deepEqual(decision, { role: "staff", consumeInvite: false });
  });

  it("promotes an existing member when they are the owner", () => {
    const decision = decideMembership({
      existingRole: "staff",
      invitedRole: null,
      emailVerified: true,
      simulated: false,
      owner: true,
    });
    assert.deepEqual(decision, { role: "admin", consumeInvite: false });
  });

  it("leaves an existing administrator in place when no new grant applies", () => {
    const decision = decideMembership({
      existingRole: "admin",
      invitedRole: null,
      emailVerified: false,
      simulated: false,
      owner: false,
    });
    assert.deepEqual(decision, { role: "admin", consumeInvite: false });
  });
});

describe("isWorkspaceOwner", () => {
  it("matches the sign-in id and a bare user id", () => {
    assert.equal(isWorkspaceOwner("user:42", "user:42"), true);
    assert.equal(isWorkspaceOwner("user:42", "42"), true);
    assert.equal(isWorkspaceOwner("user:42", "user:7"), false);
    assert.equal(isWorkspaceOwner("user:42", ""), false);
    assert.equal(isWorkspaceOwner("user:42", undefined), false);
  });
});
