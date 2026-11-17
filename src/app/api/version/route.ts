import { sql } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { LAST_MIGRATION_QUERY, versionResponse } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return versionResponse(request, {
    authorize: requireMember,
    lastMigration: async () => {
      const rows = await sql<{ name: string }>(LAST_MIGRATION_QUERY);
      return rows[0]?.name || "none";
    },
  });
}
