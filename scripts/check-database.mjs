import postgres from "postgres";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";
import { databaseSsl } from "../src/lib/db/tls.mjs";

let sql;
try {
  const url = databaseUrl();
  sql = postgres(url, { ssl: databaseSsl(url), max: 1, prepare: false, connect_timeout: 12 });
  const missing = await sql`select name from unnest(array['gt_user','gt_account','gt_session','gt_verification','gt_rate_limit','profiles','posts','member_drafts','post_bookmarks','column_replies','column_likes']) as name
    where to_regclass('public.' || name) is null`;
  if (missing.length) throw new Error(`資料表尚未就緒：${missing.map(row => row.name).join(', ')}`);
  const unsafe = await sql`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity`;
  if (unsafe.length) throw new Error("發現未啟用 RLS 的網站資料表。");
  const [role] = await sql`select rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole from pg_roles where rolname='greenthumb_app'`;
  if (!role || Object.values(role).some(Boolean)) throw new Error("網站執行角色的權限設定不正確。");
  const [counts] = await sql`select (select count(*) from public.boards) as boards,(select count(*) from public.taiwan_regions) as regions`;
  if (Number(counts.boards) < 4 || Number(counts.regions) !== 368) throw new Error("看板或行政區資料尚未就緒。");
  console.log("PASS：會員與論壇資料表、全表 RLS、受限執行角色、四個看板及 368 個行政區。");
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
finally { await sql?.end({ timeout: 3 }); }
