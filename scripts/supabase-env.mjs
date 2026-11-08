import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

export function databaseUrl() {
  let value = process.env.DATABASE_URL;
  if (!value) throw new Error("請在 .env.local 設定 DATABASE_URL。");
  if (value.includes("[YOUR-PASSWORD]")) {
    if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("請在 .env.local 設定 SUPABASE_DB_PASSWORD。");
    value = value.replace("[YOUR-PASSWORD]", encodeURIComponent(process.env.SUPABASE_DB_PASSWORD));
  }
  let target;
  try { target = new URL(value); } catch { throw new Error("DATABASE_URL 格式不正確。"); }
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("DATABASE_URL 必須是 PostgreSQL URI。");
  let ref;
  try { ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]; }
  catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL 格式不正確。"); }
  const matchesProject = target.hostname === `db.${ref}.supabase.co` ||
    (target.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(target.username).endsWith(`.${ref}`));
  if (!matchesProject) throw new Error("DATABASE_URL 與目前的 Supabase Project URL 不屬於同一個專案。");
  return value;
}
export function safeMessage(error) {
  let message = String(error.message ?? error);
  for (const name of ["DATABASE_URL", "SUPABASE_DB_PASSWORD", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
    const value = process.env[name];
    if (value) message = message.replaceAll(value, "[redacted]").replaceAll(encodeURIComponent(value), "[redacted]");
  }
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database connection]");
}
