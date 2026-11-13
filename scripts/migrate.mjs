import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = readEnv("DATABASE_URL");
const files = (await readdir("migrations").catch(() => []))
  .filter((file) => file.endsWith(".sql"))
  .sort();
if (url === "" || files.length === 0) {
  console.log("migrate: nothing to do");
  process.exit(0);
}

const client = await openClient();
try {
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((row) => row.name));
  for (const file of files.filter((name) => !done.has(name))) {
    await client.query("begin");
    try {
      for (const statement of splitSql(await readFile(`migrations/${file}`, "utf8"))) {
        await client.query(statement);
      }
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function splitSql(sql) {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function clientConfig(connectionString, forceRelaxedTls) {
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
    connectionTimeoutMillis: 20_000,
    ssl: forceRelaxedTls ? { rejectUnauthorized: false } : undefined,
  };
}

function isTlsError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /certificate|self-signed|unable to verify|ssl|tls/i.test(message);
}

async function openClient() {
  const connectionString = readEnv("DATABASE_URL_UNPOOLED") || url;
  try {
    const client = new pg.Client(clientConfig(connectionString, false));
    await client.connect();
    return client;
  } catch (error) {
    if (!isTlsError(error)) throw error;
    const client = new pg.Client(clientConfig(connectionString, true));
    await client.connect();
    return client;
  }
}
