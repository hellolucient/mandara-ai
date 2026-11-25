import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { sql } from "@/lib/db";
import { saveItemLines } from "@/lib/sales-item-store";
import { validateItemLinesExtract } from "@/lib/sales-item-validate";
import { saveExtract } from "@/lib/sales-store";
import { validateExtract } from "@/lib/sales-validate";
import { ensureSpaComparisonDemoSeed } from "@/lib/spa-comparison-seed";

const FIXTURE_DIR = path.join(process.cwd(), "fixtures/drilldown-demo");
const TOTALS_PREFIX = "totals-";
const ITEMS_PREFIX = "items-";

export function shouldSeedDrilldownDemo(stage: string): boolean {
  if (stage === "preview") return true;
  return stage === "production" && process.env.NODE_ENV === "development";
}

/** Demo totals + item lines for local Home drill-down screenshots (Vadoo/Dhonveli with items; Hakuraa without). */
export async function ensureDrilldownDemoSeed(stage: string): Promise<void> {
  if (!shouldSeedDrilldownDemo(stage)) return;
  const existing = await sql<{ value: string }>(
    "select value from settings where stage = $1 and key = 'drilldownDemoSeed'",
    [stage],
  );
  if (existing[0]?.value === "done") return;

  const files = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const file of files.filter((name) => name.startsWith(TOTALS_PREFIX))) {
    const raw = JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
    const validated = validateExtract(raw);
    if (!validated.ok) throw new Error(`drilldown demo totals ${file}: ${validated.error}`);
    await saveExtract(stage, validated.extract, "import");
  }

  for (const file of files.filter((name) => name.startsWith(ITEMS_PREFIX))) {
    const raw = JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
    const validated = validateItemLinesExtract(raw);
    if (!validated.ok) throw new Error(`drilldown demo items ${file}: ${validated.error}`);
    await saveItemLines(stage, validated.extract);
  }

  await ensureSpaComparisonDemoSeed(stage);

  await sql(
    `insert into settings (stage, key, value) values ($1, 'drilldownDemoSeed', 'done')
     on conflict (stage, key) do update set value = excluded.value`,
    [stage],
  );
}