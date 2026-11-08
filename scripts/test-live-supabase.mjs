import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";

// All data, including temporary Auth users, is rolled back. No verification mail is sent.
const sql = postgres(databaseUrl(), { ssl: "require", max: 1, prepare: false, connect_timeout: 12 });
const rollback = new Error("verified; roll back fixtures");
try {
  await sql.begin(async tx => {
    const a = randomUUID(), b = randomUUID(), admin = randomUUID();
    for (const id of [a, b, admin]) await tx`insert into auth.users (id,raw_user_meta_data) values (${id},'{"name":"連線驗證"}'::jsonb)`;
    await tx`update public.profiles set role='admin' where id=${admin}`;
    async function as(id, query) {
      await tx.unsafe("reset role");
      await tx`select set_config('request.jwt.claim.sub', ${id}, true)`;
      await tx.unsafe(`set local role ${id ? "authenticated" : "anon"}`);
      try { return await query(); } finally { await tx.unsafe("reset role"); }
    }
    const [board] = await tx`select id from public.boards where slug='foliage'`;
    const [post] = await as(a, () => tx`insert into public.posts (board_id,author_id,title,body,images,font,font_size) values (${board.id},${a},'連線驗證','**Markdown**',array['https://i.ibb.co/test/plant.webp'],'serif',18) returning id,font,font_size`);
    assert.equal(post.font, "serif"); assert.equal(post.font_size, 18);
    const anonymous = await as("", () => tx`select id from public.posts where id=${post.id}`);
    assert.equal(anonymous.length, 1);
    const denied = await as(b, () => tx`update public.posts set title='不應成功' where id=${post.id} returning id`);
    assert.equal(denied.length, 0);
    const [edited] = await as(admin, () => tx`update public.posts set title='修訂' where id=${post.id} returning author_id`);
    assert.equal(edited.author_id, a);
    const [column] = await as(a, () => tx`insert into public.expert_columns (author_id,title,excerpt,body,region_code) values (${a},'驗證專欄','簡介','內容','63000030') returning id`);
    const foreignEdit = await as(b, () => tx`update public.expert_columns set title='不應成功' where id=${column.id} returning id`);
    assert.equal(foreignEdit.length, 0);
    const [moved] = await as(a, () => tx`update public.expert_columns set region_code='10016010' where id=${column.id} returning author_id,region_code`);
    assert.equal(moved.author_id, a); assert.equal(moved.region_code, "10016010");
    const missingRls = await tx`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity`;
    assert.equal(missingRls.length, 0);
    throw rollback;
  });
} catch (error) {
  if (error === rollback) console.log("PASS live Supabase: posts, Markdown formatting, expert columns, region updates, author/admin RLS; fixtures rolled back.");
  else { console.error(safeMessage(error)); process.exitCode = 1; }
} finally { await sql.end({ timeout: 3 }); }
