import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";
import { databaseSsl } from "../src/lib/db/tls.mjs";

export async function migrateDatabase({ dryRun = false } = {}) {
  const url = databaseUrl();
  const sql = postgres(url, { ssl: databaseSsl(url), max: 1, prepare: false, connect_timeout: 12 });
  try {
    const files = readdirSync("supabase/migrations").filter(name => /^\d+_.+\.sql$/.test(name)).sort();
    const [{ own, legacy }] = await sql`select to_regclass('public.gt_schema_migrations') is not null as own,
      to_regclass('supabase_migrations.schema_migrations') is not null as legacy`;
    const known = new Map(own ? (await sql`select version,checksum from public.gt_schema_migrations`).map(row => [row.version, row.checksum]) : []);
    const old = new Set(legacy ? (await sql`select version from supabase_migrations.schema_migrations`).map(row => row.version) : []);
    const pending = files.filter(name => !known.has(name.split("_")[0]) && !old.has(name.split("_")[0]));
    for (const name of files) {
      const checksum = createHash("sha256").update(readFileSync(`supabase/migrations/${name}`)).digest("hex");
      if (known.has(name.split("_")[0]) && known.get(name.split("_")[0]) !== checksum) throw new Error(`已套用的 migration 被修改：${name}`);
    }
    if (dryRun) { console.log(`待套用 migration：${pending.join(", ") || "無"}`); return; }
    const applied = [];
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('greenthumb:migrations'))`;
      await tx.unsafe(`create table if not exists public.gt_schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now());
        alter table public.gt_schema_migrations enable row level security;
        revoke all on public.gt_schema_migrations from public;`);
      const [{ bootstrap }] = await tx`select to_regclass('public.profiles') is null as bootstrap`;
      if (bootstrap) {
        // Replay the historical migrations on ordinary PostgreSQL, then remove this compatibility scaffold.
        await tx.unsafe(`do $$ begin
          if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
          if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        end $$;
        create schema if not exists auth;
        create table auth.users (id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now());
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema auth to anon,authenticated;`);
      }
      for (const name of files) {
        const version = name.split("_")[0];
        const content = readFileSync(`supabase/migrations/${name}`, "utf8");
        const checksum = createHash("sha256").update(content).digest("hex");
        if (!known.has(version) && !old.has(version)) { await tx.unsafe(content); applied.push(name); }
        await tx`insert into public.gt_schema_migrations (version,checksum) values (${version},${checksum}) on conflict do nothing`;
      }
      if (bootstrap) await tx.unsafe("drop table auth.users; drop function auth.uid(); drop schema auth;");
      await tx.unsafe("revoke all on public.gt_schema_migrations from anon,authenticated,greenthumb_app");
    });
    for (const name of applied) console.log(`已套用 ${name}`);
  } finally { await sql.end({ timeout: 3 }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { await migrateDatabase({ dryRun: process.argv.includes("--dry-run") }); }
  catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
}
