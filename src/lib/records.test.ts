import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SCHEMA_MIGRATIONS, splitSql } from "./schema-source";
import { ensureSeed } from "./seed";
import { searchKnowledge } from "./knowledge";
import { loadDays } from "./sales-store";
import { answerSales } from "./sales-answers";
import { runSalesAgent } from "./agent";

describe("stored records", () => {
  it("keeps the published schema identical to the migration file", () => {
    const disk = readFileSync("migrations/001_init.sql", "utf8").trim();
    assert.equal(SCHEMA_MIGRATIONS[0]?.sql.trim(), disk);
    assert.ok(splitSql(disk).length >= 10);
  });

  it("seeds sample sales and keeps restricted documents away from staff", async () => {
    await ensureSeed("test");
    const days = await loadDays("test");
    const yesterday = days.find((day) => day.businessDate === "2026-11-12");
    assert.ok(yesterday);
    assert.match(answerSales({ kind: "total" }, days, "2026-11-13"), /\$11,000/);
    const staff = await searchKnowledge("test", "What does the insurance note say about certificates?", "staff");
    assert.equal(staff.hits.length, 0);
    assert.equal(staff.restrictedHidden, true);
    const admin = await searchKnowledge("test", "What does the insurance note say about certificates?", "admin");
    assert.ok(admin.hits.some((hit) => /14 days/.test(hit.excerpt)));
    const room = await searchKnowledge("test", "treatment room opening linen", "staff");
    assert.ok(room.hits.some((hit) => hit.title.includes("treatment room")));
  });

  it("records a report run without claiming it read DSR", async () => {
    await ensureSeed("test");
    const run = await runSalesAgent({ stage: "test", trigger: "manual", actor: "test", today: "2026-11-13" });
    assert.equal(run.status, "attention");
    assert.match(run.report, /12 Nov 2026/);
    assert.match(run.log, /not available to this server/);
    assert.match(run.report, /sample figures/);
  });
});
