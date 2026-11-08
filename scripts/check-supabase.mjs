import "./supabase-env.mjs";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("缺少 Supabase URL 或公開金鑰。");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } });
let failed = false;
for (const [table, columns] of [["profiles", "id,display_name,role"], ["boards", "id,slug,name"], ["posts", "id,images,font,font_size,legacy_id"], ["expert_columns", "id,region_code,author_id"], ["taiwan_regions", "code,county,district"], ["editorial_articles", "slug,title,body,published"]]) {
  const { error, status } = await client.from(table).select(columns).limit(0);
  console.log(`${error ? "FAIL" : "PASS"} ${table}: HTTP ${status}${error ? ` (${error.code ?? "network"})` : ""}`);
  if (error) failed = true;
}
const { data: boards, error: boardError } = await client.from("boards").select("slug");
for (const table of ["column_replies", "column_likes"]) {
  const { error, status } = await client.from(table).select("id,column_id,editorial_slug").limit(0);
  console.log(`${error ? "FAIL" : "PASS"} ${table}: HTTP ${status}${error ? ` (${error.code ?? "network"})` : ""}`);
  if (error) failed = true;
}
const { error: locationError } = await client.from("posts").select("region_code").limit(0);
console.log(`${locationError ? "FAIL" : "PASS"} optional post location`);
if (locationError) failed = true;
const { count, error: regionError } = await client.from("taiwan_regions").select("code", { count: "exact", head: true });
const seeded = !boardError && !regionError && ["foliage", "succulents", "herbs", "flowers"].every(slug => boards.some(b => b.slug === slug)) && count === 368;
console.log(`${seeded ? "PASS" : "FAIL"} seeds: four boards and 368 regions`);
process.exitCode = failed || !seeded ? 1 : 0;
