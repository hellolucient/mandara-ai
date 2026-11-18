import { sql } from "@/lib/db";

/**
 * A full, portable copy of one workspace (stage) for moving hosts.
 * Postgres serialises each row (row_to_json), so dates stay "YYYY-MM-DD" and timestamps keep their offset.
 * Sign-in tables (app_users, app_sessions) are never exported: passwords and sessions do not travel.
 * Read by scripts/import-export.mjs, which inserts into the new database.
 */
export const EXPORT_TABLES: Array<{ table: string; where: string }> = [
  { table: "settings", where: "stage = $1" },
  { table: "members", where: "stage = $1" },
  { table: "role_invites", where: "stage = $1" },
  { table: "locations", where: "stage = $1" },
  { table: "budgets", where: "stage = $1" },
  { table: "sales_days", where: "stage = $1" },
  { table: "sales_lines", where: "day_id in (select id from sales_days where stage = $1)" },
  { table: "documents", where: "stage = $1" },
  { table: "chunks", where: "stage = $1" },
  { table: "conversations", where: "stage = $1" },
  { table: "messages", where: "conversation_id in (select id from conversations where stage = $1)" },
  { table: "user_memories", where: "stage = $1" },
  { table: "agent_runs", where: "stage = $1" },
  { table: "usage_events", where: "stage = $1" },
  { table: "prospects", where: "stage = $1" },
  { table: "prospect_notes", where: "stage = $1" },
  { table: "prospect_signals", where: "stage = $1" },
];

export type WorkspaceExport = {
  kind: "mandara-export";
  version: 1;
  stage: string;
  exportedAt: string;
  lastMigration: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

export async function exportWorkspace(stage: string): Promise<WorkspaceExport> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const { table, where } of EXPORT_TABLES) {
    const rows = await sql<{ j: string }>(`select row_to_json(t)::text as j from ${table} t where ${where}`, [stage]);
    tables[table] = rows.map((row) => JSON.parse(row.j) as unknown);
    counts[table] = rows.length;
  }
  const migration = await sql<{ name: string }>("select name from schema_migrations order by name desc limit 1").catch(() => []);
  return {
    kind: "mandara-export",
    version: 1,
    stage,
    exportedAt: new Date().toISOString(),
    lastMigration: migration[0]?.name ?? "unknown",
    tables,
    counts,
  };
}
