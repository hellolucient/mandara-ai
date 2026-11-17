import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { json } from "./http.js";
import { LAST_MIGRATION_QUERY, versionResponse } from "./version.js";

const request = new Request("https://mandara.example/api/version");
const env = { COMMIT_SHA: "4834fab" };

describe("version endpoint", () => {
  it("refuses signed-out callers without revealing deployment metadata", async () => {
    let queried = false;
    const response = await versionResponse(request, {
      authorize: async () => json({ error: "Sign in to use Mandara AI." }, 401),
      lastMigration: async () => {
        queried = true;
        return "015_profile_remove_prospects.sql";
      },
      env,
    });
    assert.equal(response.status, 401);
    const body = await response.text();
    assert.doesNotMatch(body, /4834fab|015_profile|commit|lastMigration/);
    assert.equal(queried, false, "must not touch the database before auth");
  });

  it("passes through a 403 for unverified callers", async () => {
    const response = await versionResponse(request, {
      authorize: async () => json({ error: "Verify your email address to use Mandara AI." }, 403),
      lastMigration: async () => "x",
      env,
    });
    assert.equal(response.status, 403);
  });

  it("returns commit and last migration to signed-in members, never cached", async () => {
    const response = await versionResponse(request, {
      authorize: async () => ({ role: "staff" }),
      lastMigration: async () => "015_profile_remove_prospects.sql",
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { commit: "4834fab", lastMigration: "015_profile_remove_prospects.sql" });
  });

  it("reports a query failure without leaking the error", async () => {
    const response = await versionResponse(request, {
      authorize: async () => ({ role: "admin" }),
      lastMigration: async () => {
        throw new Error("connection string postgres://secret");
      },
      env: {},
    });
    assert.deepEqual(await response.json(), { commit: "unknown", lastMigration: "error-querying" });
  });

  it("queries schema_migrations and the route uses requireMember", () => {
    assert.equal(LAST_MIGRATION_QUERY, "select name from schema_migrations order by name desc limit 1");
    const route = readFileSync("src/app/api/version/route.ts", "utf8");
    assert.match(route, /authorize: requireMember/);
    assert.match(route, /export async function GET\(request: Request\)/);
  });
});
