import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { SCHEMA_MIGRATIONS, splitSql } from "@/lib/schema-source";

let pool: pg.Pool | undefined;
let relaxSsl = false;
let local: Promise<PGlite> | undefined;
let schemaReady: Promise<void> | undefined;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl() !== "") {
    await ensureSchema();
    try {
      return (await getPool().query(text, params)).rows as T[];
    } catch (error) {
      if (!relaxSsl && isTlsError(error)) {
        await pool?.end().catch(() => undefined);
        pool = undefined;
        relaxSsl = true;
        return (await getPool().query(text, params)).rows as T[];
      }
      throw error;
    }
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
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
    ...clientConfig(databaseUrl(), relaxSsl),
    max: 1,
    idleTimeoutMillis: 20_000,
  });
  return pool;
}

function clientConfig(connectionString: string, forceRelaxedTls: boolean): pg.ClientConfig {
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
    ssl: forceRelaxedTls ? { rejectUnauthorized: false } : undefined,
  };
}

function isTlsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /certificate|self-signed|unable to verify|ssl|tls/i.test(message);
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
  try {
    const client = new pg.Client(clientConfig(directUrl(), relaxSsl));
    await client.connect();
    return client;
  } catch (error) {
    if (relaxSsl || !isTlsError(error)) throw error;
    relaxSsl = true;
    const client = new pg.Client(clientConfig(directUrl(), true));
    await client.connect();
    return client;
  }
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
