import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { SCHEMA_MIGRATIONS, splitSql } from "@/lib/schema-source";

let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;
let schemaReady: Promise<void> | undefined;

/** True inside Cloudflare Workers (OpenNext). There is no filesystem and I/O cannot be shared between requests. */
export function onWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (onWorkers()) return workersQuery<T>(text, params);
  if (databaseUrl() !== "") {
    await ensureSchema();
    return (await getPool().query(text, params)).rows as T[];
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
}

/**
 * On Cloudflare one connection is opened per request, through Hyperdrive (which keeps the real Postgres
 * connections pooled and warm), and reused by every query in that request. Workers cannot share sockets
 * between requests, so the connection is keyed to the request context and closed shortly after the last
 * query, while ctx.waitUntil keeps the request alive. Migrations are not run here: `npm run db:migrate`
 * applies them at deploy time.
 */
type RequestDb = { client: Promise<pg.Client>; active: number; timer?: ReturnType<typeof setTimeout>; done?: () => void };
const requestClients = new WeakMap<object, RequestDb>();
const IDLE_CLOSE_MS = 250;

async function workersQuery<T>(text: string, params: unknown[]): Promise<T[]> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = getCloudflareContext();
  const key = context.ctx as unknown as object;
  let entry = requestClients.get(key);
  if (!entry) {
    const client = new pg.Client({ connectionString: workersConnectionString(context.env), connectionTimeoutMillis: 12_000 });
    const created: RequestDb = { client: client.connect().then(() => client), active: 0 };
    created.client.catch(() => {
      requestClients.delete(key);
      created.done?.();
    });
    context.ctx.waitUntil(new Promise<void>((resolve) => (created.done = resolve)));
    requestClients.set(key, created);
    entry = created;
  }
  const current = entry;
  if (current.timer) clearTimeout(current.timer);
  current.active += 1;
  try {
    const client = await current.client;
    return (await client.query(text, params)).rows as T[];
  } finally {
    current.active -= 1;
    if (current.active === 0) current.timer = setTimeout(() => {
      requestClients.delete(key);
      current.client
        .then((client) => client.end())
        .catch(() => undefined)
        .finally(() => current.done?.());
    }, IDLE_CLOSE_MS);
  }
}

function workersConnectionString(bindings: unknown): string {
  const env = bindings as Record<string, unknown>;
  const hyperdrive = env.HYPERDRIVE as { connectionString?: string } | undefined;
  const url = hyperdrive?.connectionString || (typeof env.DATABASE_URL === "string" ? env.DATABASE_URL : "") || databaseUrl();
  if (!url) throw new Error("No database is configured (HYPERDRIVE binding or DATABASE_URL).");
  return url;
}

function databaseUrl(): string {
  return readEnv("DATABASE_URL");
}

function directUrl(): string {
  return readEnv("DATABASE_URL_UNPOOLED") || databaseUrl();
}

function readEnv(name: "DATABASE_URL" | "DATABASE_URL_UNPOOLED"): string {
  const inlined = name === "DATABASE_URL" ? process.env.DATABASE_URL : process.env.DATABASE_URL_UNPOOLED;
  if (typeof inlined === "string" && inlined.trim()) return inlined.trim();
  const runtime = process.env[name];
  return typeof runtime === "string" ? runtime.trim() : "";
}

function getPool(): pg.Pool {
  pool ??= new pg.Pool({
    ...clientConfig(databaseUrl()),
    max: 1,
    idleTimeoutMillis: 20_000,
  });
  return pool;
}

function clientConfig(connectionString: string): pg.ClientConfig {
  let connection = connectionString;
  const localHost = /@(localhost|127\.0\.0\.1)(?::|\/|$)/.test(connection);
  if (
    !localHost &&
    /(?:\?|&)sslmode=(?:require|prefer|verify-ca)(?:&|$)/i.test(connection) &&
    !/uselibpqcompat=/i.test(connection)
  ) {
    connection += `${connection.includes("?") ? "&" : "?"}uselibpqcompat=true`;
  }
  return {
    connectionString: connection,
    connectionTimeoutMillis: 12_000,
  };
}

async function ensureSchema(): Promise<void> {
  schemaReady ??= applySchema().catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

async function applySchema(): Promise<void> {
  const client = await openClient();
  try {
    await client.query("set lock_timeout = '60s'");
    await client.query("select pg_advisory_lock(7272741)");
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set(
      (await client.query<{ name: string }>("select name from schema_migrations")).rows.map((row) => row.name),
    );
    for (const file of await migrationBodies()) {
      if (done.has(file.name)) continue;
      await client.query("begin");
      try {
        for (const statement of splitSql(file.sql)) await client.query(statement);
        await client.query("insert into schema_migrations (name) values ($1)", [file.name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function openClient(): Promise<pg.Client> {
  const client = new pg.Client(clientConfig(directUrl()));
  await client.connect();
  return client;
}

async function migrationBodies(): Promise<Array<{ name: string; sql: string }>> {
  try {
    const dir = path.join(process.cwd(), "migrations");
    const names = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    if (names.length === 0) return SCHEMA_MIGRATIONS;
    return Promise.all(
      names.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), "utf8") })),
    );
  } catch {
    return SCHEMA_MIGRATIONS;
  }
}

async function startLocal(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const bodies =
    files.length > 0
      ? await Promise.all(files.map(async (file) => readFile(`migrations/${file}`, "utf8")))
      : SCHEMA_MIGRATIONS.map((file) => file.sql);
  for (const body of bodies) {
    for (const statement of splitSql(body)) await db.exec(statement);
  }
  return db;
}
