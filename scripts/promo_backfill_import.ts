#!/usr/bin/env tsx
/**
 * Import promo JSON files into Postgres (no app session required).
 * Usage: DATABASE_URL=<direct-neon> npx tsx scripts/promo_backfill_import.ts [--stage production]
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { validatePromotionsExtract } from "../src/lib/promo-validate";
import { savePromotions } from "../src/lib/promo-store";

const stage = process.argv.includes("--stage")
  ? process.argv[process.argv.indexOf("--stage") + 1] ?? "production"
  : "production";

const jsonDir = join(process.cwd(), "data/promo-backfill/json");

async function main() {
  if (!process.env.DATABASE_URL?.trim() && !process.env.DATABASE_URL_UNPOOLED?.trim()) {
    console.error("Set DATABASE_URL or DATABASE_URL_UNPOOLED.");
    process.exit(1);
  }
  const files = (await readdir(jsonDir)).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.error(`No JSON in ${jsonDir}. Run npm run promo:json first.`);
    process.exit(1);
  }
  let ok = 0;
  for (const file of files) {
    const raw = await readFile(join(jsonDir, file), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const validated = validatePromotionsExtract(parsed);
    if (!validated.ok) {
      console.error(`${file}: ${validated.error}`);
      process.exit(1);
    }
    const saved = await savePromotions(stage, validated.extract);
    console.log(
      `${file}: ${validated.extract.kind} ${validated.extract.periodFrom}..${validated.extract.periodTo} · ` +
        `${saved.lines} lines · $${validated.extract.totals.totalUsd.toLocaleString("en-US")}`,
    );
    ok += 1;
  }
  console.log(`Imported ${ok} file(s) into stage=${stage}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});