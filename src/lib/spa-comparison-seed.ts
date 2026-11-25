import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "@/lib/db";
import { importStatisticPeriodFile } from "@/lib/statistic-period-import";
import { shouldSeedDrilldownDemo } from "@/lib/drilldown-demo-seed";

const FIXTURE = join(process.cwd(), "fixtures/statistic-period/stat_2025-11-01_2025-11-24_Treatment.txt");

/** Seeds LY partial-month period items for Home comparison screenshots. */
export async function ensureSpaComparisonDemoSeed(stage: string): Promise<void> {
  if (!shouldSeedDrilldownDemo(stage)) return;
  const existing = await sql<{ value: string }>(
    "select value from settings where stage = $1 and key = 'spaComparisonSeed'",
    [stage],
  );
  if (existing[0]?.value === "done") return;

  const execute = async (text: string, params: unknown[] = []) => sql(text, params);
  const text = readFileSync(FIXTURE, "utf8");
  await importStatisticPeriodFile(execute, stage, text, "stat_2025-11-01_2025-11-24_Treatment.txt");

  await sql(
    `insert into settings (stage, key, value) values ($1, 'spaComparisonSeed', 'done')
     on conflict (stage, key) do update set value = excluded.value`,
    [stage],
  );
}