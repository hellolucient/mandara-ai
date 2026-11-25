import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "@/lib/db";
import { validatePromotionsExtract } from "@/lib/promo-validate";
import { savePromotions } from "@/lib/promo-store";

const FILES = [
  "promo_treatment_2026-09-01_2026-09-30.json",
  "promo_treatment_2026-10-01_2026-10-31.json",
  "promo_treatment_2026-11-01_2026-11-24.json",
  "promo_treatment_2026-11-24_2026-11-24.json",
  "promo_retail_2026-11-01_2026-11-24.json",
];

export async function seedPromoBackfill(stage: string): Promise<{ imported: number }> {
  const rows = await sql<{ value: string }>(
    "select value from settings where stage = $1 and key = 'promoBackfillSeed'",
    [stage],
  );
  if (rows[0]?.value === "done") return { imported: 0 };

  const root = join(process.cwd(), "data/promo-backfill/json");
  let imported = 0;
  for (const file of FILES) {
    const path = join(root, file);
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const validated = validatePromotionsExtract(parsed);
      if (!validated.ok) continue;
      await savePromotions(stage, validated.extract);
      imported += 1;
    } catch {
      // JSON files may not exist until promo_backfill_generate.mjs is run.
    }
  }
  if (imported > 0) {
    await sql(
      `insert into settings (stage, key, value) values ($1, 'promoBackfillSeed', 'done')
       on conflict (stage, key) do update set value = excluded.value`,
      [stage],
    );
  }
  return { imported };
}