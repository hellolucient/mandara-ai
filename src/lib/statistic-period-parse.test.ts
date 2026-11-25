import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import { parseStatisticPeriodFile } from "@/lib/statistic-period-parse";

describe("statistic period parse", () => {
  it("parses a treatment snippet and maps spa names", () => {
    const text = readFileSync(
      join(process.cwd(), "fixtures/statistic-period/stat_2025-11-01_2025-11-24_Treatment.txt"),
      "utf8",
    );
    const result = parseStatisticPeriodFile(text, "stat_2025-11-01_2025-11-24_Treatment.txt");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.parsed.periodFrom, "2025-11-01");
    assert.equal(result.parsed.kind, "treatment");
    const dhonveli = result.parsed.items.filter((i) => i.location === "Dhonveli");
    assert.ok(dhonveli.length >= 2);
    assert.equal(dhonveli[0]?.nett, 600);
  });
});