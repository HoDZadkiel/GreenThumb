import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";
import { migrateDatabase } from "./migrate-database.mjs";
import { databaseSsl } from "../src/lib/db/tls.mjs";

try {
  await migrateDatabase();
  const adminURL = databaseUrl();
  const parsed = new URL(adminURL);
  const sql = postgres(adminURL, { max: 1, prepare: false, connect_timeout: 12,
    ssl: databaseSsl(adminURL) });
  const additions = {};
  try {
    const [role] = await sql`select rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole,rolreplication
      from pg_roles where rolname='greenthumb_app'`;
    if (!role || Object.values(role).some(Boolean)) throw new Error("網站執行角色的權限設定不正確，未建立登入憑證。");
    if (!process.env.APP_DATABASE_URL) {
      const password = randomBytes(32).toString("base64url");
      // Only the SQL driver handles this statement; neither the password nor URI is logged.
      // Attributes were checked above. A managed PostgreSQL administrator cannot
      // restate NOSUPERUSER, even when the role is already a non-superuser.
      const [row] = await sql`select format('alter role %I login password %L', 'greenthumb_app', ${password}::text) as command`;
      await sql.unsafe(row.command);
      const suffix = decodeURIComponent(parsed.username).split(".").slice(1).join(".");
      parsed.username = "greenthumb_app" + (suffix ? `.${suffix}` : "");
      parsed.password = password;
      parsed.searchParams.set("sslmode", ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ? "disable" : "verify-full");
      additions.APP_DATABASE_URL = parsed.href;
    }
  } finally { await sql.end({ timeout: 3 }); }
  if (!process.env.BETTER_AUTH_SECRET) additions.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
  if (!process.env.BETTER_AUTH_URL) additions.BETTER_AUTH_URL = "http://localhost:3000";
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SMTP_USER", "SMTP_PASSWORD"]) {
    if (process.env[name] === undefined) additions[name] = "";
  }
  if (process.env.AUTH_EMAIL_ENABLED === undefined) additions.AUTH_EMAIL_ENABLED = "false";
  let contents = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  for (const [name, value] of Object.entries(additions)) {
    const line = `${name}=${value}`;
    const match = new RegExp(`^${name}=.*$`, "m");
    contents = match.test(contents) ? contents.replace(match, () => line) : contents.trimEnd() + "\n" + line + "\n";
  }
  writeFileSync(".env.local", contents);
  console.log("會員資料庫與受限執行帳號已就緒；設定已安全寫入 .env.local。請填入 Google OAuth 憑證後重啟網站。");
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
