import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureDrilldownDemoSeed } from "./drilldown-demo-seed";
import { loadItemLinesForSpa } from "./sales-item-store";
import { loadDays } from "./sales-store";
import { getSpaSummaries } from "./home-kpis";
import { sql } from "./db";

describe("drilldown demo seed", () => {
  it("loads three days of totals and item lines for Vadoo", async () => {
    const stage = "preview";
    await sql("delete from settings where stage = $1 and key = 'drilldownDemoSeed'", [stage]);
    await ensureDrilldownDemoSeed(stage);
    await ensureDrilldownDemoSeed(stage);
    const days = await loadDays(stage);
    const nov20 = days.find((d) => d.businessDate === "2026-11-20");
    assert.ok(nov20);
    const vadoo = nov20.lines.find((l) => l.locationName === "Vadoo");
    assert.equal(vadoo?.treatmentSales, 320);
    assert.equal(vadoo?.retailSales, 95);

    const loc = await sql<{ id: string }>(
      "select id from locations where stage = $1 and lower(name) = lower($2)",
      [stage, "Vadoo"],
    );
    assert.ok(loc[0]);
    const items = await loadItemLinesForSpa(stage, loc[0].id, "2026-11-20", "2026-11-20");
    assert.ok(items.length >= 2);

    const spas = await getSpaSummaries(stage, "2026-11-24");
    assert.ok(spas.some((s) => s.locationName === "Hakuraa Huraa"));
  });
});