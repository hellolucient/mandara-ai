import { json } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let lastMigration = "unknown";
  try {
    const migrations = await sql<{ name: string }>(
      "select name from schema_migrations order by name desc limit 1",
    );
    lastMigration = migrations[0]?.name || "none";
  } catch {
    lastMigration = "error-querying";
  }
  
  return json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown",
    lastMigration,
  });
}
