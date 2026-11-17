import { json } from "@/lib/http";

export type VersionDeps = {
  /** Returns a Response (401/403) when the caller is not a signed-in member. */
  authorize: (request: Request) => Promise<unknown>;
  lastMigration: () => Promise<string>;
  env?: Record<string, string | undefined>;
};

export const LAST_MIGRATION_QUERY = "select name from schema_migrations order by name desc limit 1";

/**
 * Deployment metadata (commit and latest migration) for signed-in members only.
 * Nothing unauthenticated relies on this endpoint, so signed-out callers get 401.
 */
export async function versionResponse(request: Request, deps: VersionDeps): Promise<Response> {
  const auth = await deps.authorize(request);
  if (auth instanceof Response) return auth;
  const env = deps.env ?? process.env;
  let lastMigration = "unknown";
  try {
    lastMigration = (await deps.lastMigration()) || "none";
  } catch {
    lastMigration = "error-querying";
  }
  return json({
    commit: env.VERCEL_GIT_COMMIT_SHA || env.COMMIT_SHA || "unknown",
    lastMigration,
  });
}
