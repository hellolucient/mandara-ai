#!/usr/bin/env node
/**
 * Convert data/promo-backfill/*.csv to data/promo-backfill/json/*.json for Import a file.
 * Usage: node scripts/promo_backfill_generate.mjs [--check]
 */
import { execFileSync } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

const root = join(import.meta.dirname, "..");
const srcDir = join(root, "data/promo-backfill");
const outDir = join(srcDir, "json");

const checkOnly = process.argv.includes("--check");

const files = (await readdir(srcDir)).filter((f) => f.endsWith(".csv")).sort();
await mkdir(outDir, { recursive: true });

for (const file of files) {
  const csv = join(srcDir, file);
  const args = [join(root, "scripts/promo_to_import.py"), csv];
  if (!checkOnly) args.push("-o", join(outDir, file.replace(/\.csv$/, ".json")));
  else args.push("--check-only");
  try {
    execFileSync("python3", args, { cwd: root, stdio: "inherit" });
  } catch {
    console.error(`Failed on ${file}`);
    process.exit(1);
  }
  if (!checkOnly) {
    console.log(`Wrote json/${basename(file, ".csv")}.json`);
  }
}