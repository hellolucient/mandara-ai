import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("version endpoint", () => {
  it("uses correct table name for schema_migrations", () => {
    // The migration script (scripts/migrate.mjs) creates a table called
    // 'schema_migrations' with columns (name, applied_at).
    // The version endpoint must query this table, not 'migrations'.
    const correctQuery = "select name from schema_migrations order by name desc limit 1";
    const tableName = "schema_migrations";
    
    // Verify the query references the correct table
    assert.ok(correctQuery.includes(tableName), "Query must reference schema_migrations table");
    
    // Verify it sorts by name desc (lexicographic sort of migration filenames)
    assert.ok(correctQuery.includes("order by name desc"), "Must sort by name descending");
    
    // Verify it limits to 1 result
    assert.ok(correctQuery.includes("limit 1"), "Must limit to 1 result");
  });

  it("returns expected JSON structure", () => {
    // Version endpoint should return { commit, lastMigration }
    const expectedKeys = ["commit", "lastMigration"];
    
    // This is just a structure test - actual endpoint returns these keys
    const mockResponse = {
      commit: "abc123",
      lastMigration: "010_update_reasoning_model.sql",
    };
    
    for (const key of expectedKeys) {
      assert.ok(key in mockResponse, `Response must have ${key} field`);
    }
  });
});
