// Loads a /api/admin/export file into a Mandara database (for example the new Neon database).
// Usage: DATABASE_URL=... node scripts/import-export.mjs path/to/mandara-export-production-YYYY-MM-DD.json [--stage production]
// Run `npm run db:migrate` first. Existing rows are kept (on conflict do nothing), so it is safe to run twice.
// Only columns that exist in both the file and the target table are written; new columns keep their defaults.
import { readFile } from "node:fs/promises";
import pg from "pg";

const file = process.argv[2];
const stageArg = process.argv.indexOf("--stage");
if (!file) {
  console.error("Usage: node scripts/import-export.mjs <export.json> [--stage production]");
  process.exit(2);
}
const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "").trim();
if (!url) {
  console.error("Set DATABASE_URL (it is never printed).");
  process.exit(2);
}
const data = JSON.parse(await readFile(file, "utf8"));
if (data.kind !== "mandara-export") throw new Error("Not a Mandara export file.");
const targetStage = stageArg > 0 ? process.argv[stageArg + 1] : data.stage;

const ORDER = [
  "settings", "members", "role_invites", "locations", "budgets", "sales_days", "sales_lines", "sales_item_lines", "promo_periods", "promo_lines", "documents", "chunks",
  "conversations", "messages", "user_memories", "agent_runs", "usage_events", "prospects", "prospect_notes", "prospect_signals",
];

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20_000 });
await client.connect();
try {
  await client.query("begin");
  for (const table of ORDER) {
    const rows = data.tables[table] ?? [];
    if (!rows.length) {
      console.log(`${table}: 0`);
      continue;
    }
    const cols = new Set(
      (await client.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [table])).rows.map((r) => r.column_name),
    );
    let inserted = 0;
    for (const raw of rows) {
      const row = { ...raw };
      if ("stage" in row && targetStage) row.stage = targetStage;
      const keys = Object.keys(row).filter((key) => cols.has(key));
      const list = keys.map((key) => `"${key}"`).join(", ");
      const result = await client.query(
        `insert into ${table} (${list}) select ${list} from jsonb_populate_record(null::${table}, $1::jsonb) on conflict do nothing`,
        [JSON.stringify(row)],
      );
      inserted += result.rowCount ?? 0;
    }
    console.log(`${table}: ${inserted} of ${rows.length} inserted`);
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
