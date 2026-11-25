import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";
import { isPromotionsImport, validatePromotionsExtract } from "@/lib/promo-validate";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function runConverter(csvName: string): unknown {
  const csv = join(root, "data/promo-backfill", csvName);
  const out = execFileSync("python3", ["scripts/promo_to_import.py", csv], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out);
}

describe("promo validate", () => {
  test("detects promotion JSON from python converter", () => {
    const payload = runConverter("promo_treatment_2026-11-24_2026-11-24.csv");
    assert.equal(isPromotionsImport(payload), true);
    const validated = validatePromotionsExtract(payload);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    assert.equal(validated.extract.totals.totalUsd, 10467.83);
    assert.equal(validated.extract.rows.length > 0, true);
  });

  test("rejects totals-shaped JSON", () => {
    const sample = JSON.parse(readFileSync(join(root, "fixtures/drilldown-demo/totals-2026-11-18.json"), "utf8"));
    assert.equal(isPromotionsImport(sample), false);
  });
});