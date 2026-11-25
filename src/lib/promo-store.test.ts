import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { validatePromotionsExtract } from "@/lib/promo-validate";
import { listPromoPeriods, loadPromoLines, savePromotions } from "@/lib/promo-store";

const stage = `promo-store-${Date.now()}`;

test("savePromotions replaces the same range and kind", async () => {
  const raw = readFileSync(
    join(process.cwd(), "data/promo-backfill/json/promo_treatment_2026-11-24_2026-11-24.json"),
    "utf8",
  );
  const validated = validatePromotionsExtract(JSON.parse(raw));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  await savePromotions(stage, validated.extract);
  const periods = await listPromoPeriods(stage);
  assert.equal(periods.length, 1);
  assert.equal(periods[0].totalUsd, 10467.83);

  const lines = await loadPromoLines(stage, "2026-11-24", "2026-11-24", "treatment");
  assert.ok(lines.length > 0);

  const smaller = {
    ...validated.extract,
    rows: validated.extract.rows.slice(0, 3),
    totals: { ...validated.extract.totals, totalUsd: 1 },
  };
  await savePromotions(stage, smaller);
  const again = await loadPromoLines(stage, "2026-11-24", "2026-11-24", "treatment");
  assert.equal(again.length, 3);
});