import { readFileSync } from "node:fs";

export function databaseSsl(url, env = process.env) {
  const target = new URL(url);
  if (["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) return false;
  const ca = env.DATABASE_CA_CERT?.replaceAll("\\n", "\n") ||
    (env.DATABASE_CA_FILE ? readFileSync(env.DATABASE_CA_FILE, "utf8") : undefined);
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}
