import { Pool } from "pg";
import { databaseSsl } from "./tls.mjs";

const globals = globalThis;

export function runtimeDatabaseUrl(env = process.env) {
  const value = env.APP_DATABASE_URL;
  if (!value) throw new Error("請設定 APP_DATABASE_URL，並先執行 npm run db:setup-auth。");
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("APP_DATABASE_URL 必須是 PostgreSQL URI。");
  if (!parsed.searchParams.has("sslmode") && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    parsed.searchParams.set("sslmode", "verify-full");
  }
  return parsed.href;
}

export function databasePool() {
  if (!globals.greenthumbPool) {
    const url = new URL(runtimeDatabaseUrl());
    const ssl = databaseSsl(url.href);
    // URL SSL parameters otherwise override the explicitly supplied CA in node-postgres.
    for (const parameter of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(parameter);
    globals.greenthumbPool = new Pool({
      connectionString: url.href,
      ssl,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 12_000,
      query_timeout: 15_000,
      application_name: "greenthumb",
    });
    // Do not log driver errors: they can contain connection details.
    globals.greenthumbPool.on("error", () => {});
  }
  return globals.greenthumbPool;
}

// The SET LOCAL values and role end with this transaction, including on pooled connections.
export async function withMemberDatabase(pool, userId, work) {
  if (userId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("無效的會員身分。");
  }
  const connection = await pool.connect();
  let broken = false;
  try {
    await connection.query("begin");
    await connection.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    await connection.query(userId ? "set local role authenticated" : "set local role anon");
    const result = await work(connection);
    await connection.query("commit");
    return result;
  } catch (error) {
    try { await connection.query("rollback"); } catch { broken = true; }
    throw error;
  } finally {
    connection.release(broken);
  }
}
