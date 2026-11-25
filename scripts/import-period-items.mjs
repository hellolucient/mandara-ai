#!/usr/bin/env node
/**
 * Import Steiners Statistic Entry range files (Treatment / Retail Summary).
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-period-items.mjs stat_2025-11-01_2025-11-24_Treatment.txt ...
 *
 * Works with direct Postgres or Neon HTTP when DATABASE_URL is set.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { importStatisticPeriodFile } from "../src/lib/statistic-period-import.ts";

const stage = process.env.APP_STAGE?.trim() === "preview" ? "preview" : "production";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: DATABASE_URL=... npx tsx scripts/import-period-items.mjs <file...>");
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const execute = async (text, params = []) => (await pool.query(text, params)).rows;
  try {
    for (const file of files) {
      const path = resolve(file);
      const text = readFileSync(path, "utf8");
      const result = await importStatisticPeriodFile(execute, stage, text, path);
      if (!result.ok) {
        console.error(`${file}: ${result.error}`);
        process.exitCode = 1;
        continue;
      }
      console.log(
        `${file}: ${result.kind} ${result.periodFrom}–${result.periodTo} · ${result.rows} rows (stage=${stage})`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});