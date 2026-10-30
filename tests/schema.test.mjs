import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const md = fs.readFileSync(process.argv[2], 'utf8');
const sql = md.match(/```sql\n([\s\S]*?)```/)[1];
const db = new PGlite();
// Supabase 環境的最小替身
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
`);
await db.exec(sql);
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;`);
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', M='00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${A}','{"name":"小A"}'),('${B}','{}'),('${M}','{}');
update public.profiles set role='moderator' where id='${M}';
insert into public.boards (slug,name) values ('foliage','觀葉');
insert into public.species (slug,scientific_name,common_name) values ('monstera','Monstera deliciosa','龜背芋');`);
const as = async (uid, q) => { await db.exec(`reset role; set test.uid='${uid}'; set role authenticated;`); try { return await db.query(q); } finally { await db.exec('reset role'); } };
const results = [];
const check = async (name, fn) => { try { const ok = await fn(); results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`); } catch (e) { results.push(`FAIL  ${name}: ${e.message}`); } };
const rejects = async (p) => { try { await p; return false; } catch { return true; } };

await check('註冊自動建立 profile', async () => (await db.query(`select display_name from public.profiles where id='${A}'`)).rows[0].display_name === '小A');
await check('A 可以發文', async () => (await as(A, `insert into public.posts (board_id,author_id,title,body) values (1,'${A}','龜背芋黃葉','怎麼辦') returning id`)).rows[0].id === 1);
await check('不能冒用 B 的身分發文', () => rejects(as(A, `insert into public.posts (board_id,author_id,title,body) values (1,'${B}','x','x')`)));
await check('發文時不能自己置頂', () => rejects(as(A, `insert into public.posts (board_id,author_id,title,body,is_pinned) values (1,'${A}','x','x',true)`)));
await check('作者可以標記物種', async () => (await as(A, `insert into public.post_species values (1,1) returning *`)).rows.length === 1);
await check('B 回覆後 reply_count = 1', async () => { await as(B, `insert into public.replies (post_id,author_id,body) values (1,'${B}','多曬太陽')`); return (await db.query('select reply_count from public.posts where id=1')).rows[0].reply_count === 1; });
await check('作者改 is_pinned／reply_count 會被還原', async () => { await as(A, `update public.posts set is_pinned=true, reply_count=99, title='改標題' where id=1`); const r = (await db.query('select is_pinned,reply_count,title from public.posts where id=1')).rows[0]; return !r.is_pinned && r.reply_count === 1 && r.title === '改標題'; });
await check('B 無法修改 A 的文章', async () => { await as(B, `update public.posts set title='hack' where id=1`); return (await db.query('select title from public.posts where id=1')).rows[0].title === '改標題'; });
await check('會員不能把自己升為 admin', async () => { await as(A, `update public.profiles set role='admin', bio='hi' where id='${A}'`); const r = (await db.query(`select role,bio from public.profiles where id='${A}'`)).rows[0]; return r.role === 'member' && r.bio === 'hi'; });
await check('版主可以鎖文', async () => { await as(M, `update public.posts set is_locked=true where id=1`); return (await db.query('select is_locked from public.posts where id=1')).rows[0].is_locked; });
await check('鎖定的文章不能回覆', () => rejects(as(B, `insert into public.replies (post_id,author_id,body) values (1,'${B}','x')`)));
await check('檢舉只有版主看得到', async () => { await as(B, `insert into public.reports (reporter_id,post_id,reason) values ('${B}',1,'廣告')`); return (await as(B, 'select * from public.reports')).rows.length === 0 && (await as(M, 'select * from public.reports')).rows.length === 1; });
await check('軟刪除的文章訪客看不到、作者看得到', async () => { await as(A, `update public.posts set deleted_at=now() where id=1`); await db.exec(`set test.uid=''; set role anon`); const anon = (await db.query('select * from public.posts')).rows.length; await db.exec('reset role'); return anon === 0 && (await as(A, 'select * from public.posts')).rows.length === 1; });
await check('檢舉必須且只能指向一個目標', () => rejects(as(B, `insert into public.reports (reporter_id,reason) values ('${B}','x')`)));
await check('版主不能自行升為 admin', async () => { await as(M, `update public.profiles set role='admin' where id='${M}'`); return (await db.query(`select role from public.profiles where id='${M}'`)).rows[0].role === 'moderator'; });

// ---- 文章類型、地區、按讚、最佳解答、標籤 ----
const one = async (uid, q) => (await as(uid, q)).rows[0];
const q2 = await one(A, `insert into public.posts (board_id,author_id,post_type,region,title,body) values (1,'${A}','question','north','多肉化水','救命') returning id`);
const s3 = await one(A, `insert into public.posts (board_id,author_id,post_type,title,body) values (1,'${A}','share','曬一下','我的龜背芋') returning id`);
const rB = await one(B, `insert into public.replies (post_id,author_id,body) values (${q2.id},'${B}','減少澆水') returning id`);
const rOther = (await db.query(`select id from public.replies where post_id=1`)).rows[0];
const postRow = async (id) => (await db.query(`select * from public.posts where id=${id}`)).rows[0];

await check('地區只接受固定選項', () => rejects(as(A, `insert into public.posts (board_id,author_id,region,title,body) values (1,'${A}','taipei','x','x')`)));
await check('按讚後 like_count = 1', async () => { await as(B, `insert into public.post_likes (post_id,user_id) values (${q2.id},'${B}')`); return (await postRow(q2.id)).like_count === 1; });
await check('同一人不能重複按讚', () => rejects(as(B, `insert into public.post_likes (post_id,user_id) values (${q2.id},'${B}')`)));
await check('不能用別人的身分按讚', () => rejects(as(B, `insert into public.post_likes (post_id,user_id) values (${q2.id},'${A}')`)));
await check('作者竄改 like_count 會被還原', async () => { await as(A, `update public.posts set like_count=99 where id=${q2.id}`); return (await postRow(q2.id)).like_count === 1; });
await check('收回讚後 like_count = 0', async () => { await as(B, `delete from public.post_likes where post_id=${q2.id}`); return (await postRow(q2.id)).like_count === 0; });
await check('回覆按讚會更新回覆的 like_count', async () => { await as(A, `insert into public.reply_likes (reply_id,user_id) values (${rB.id},'${A}')`); return (await db.query(`select like_count from public.replies where id=${rB.id}`)).rows[0].like_count === 1; });
await check('回覆作者竄改 like_count 會被還原', async () => { await as(B, `update public.replies set like_count=50 where id=${rB.id}`); return (await db.query(`select like_count from public.replies where id=${rB.id}`)).rows[0].like_count === 1; });
await check('發問者可以選最佳解答', async () => { await as(A, `update public.posts set accepted_reply_id=${rB.id} where id=${q2.id}`); return (await postRow(q2.id)).accepted_reply_id === rB.id; });
await check('不能選別篇文章的回覆當最佳解答', () => rejects(as(A, `update public.posts set accepted_reply_id=${rOther.id} where id=${q2.id}`)));
await check('分享文不能設最佳解答', () => rejects(as(A, `update public.posts set accepted_reply_id=${rB.id} where id=${s3.id}`)));
await check('B 不能替 A 選最佳解答', async () => { await as(A, `update public.posts set accepted_reply_id=null where id=${q2.id}`); await as(B, `update public.posts set accepted_reply_id=${rB.id} where id=${q2.id}`); return (await postRow(q2.id)).accepted_reply_id === null; });
await check('最佳解答被刪除時只清空欄位、文章保留', async () => { await as(A, `update public.posts set accepted_reply_id=${rB.id} where id=${q2.id}`); await db.query(`delete from public.replies where id=${rB.id}`); const p = await postRow(q2.id); return p && p.accepted_reply_id === null; });
await check('會員可以新增標籤', async () => (await one(B, `insert into public.tags (slug,name,created_by) values ('扦插','扦插','${B}') returning id`)).id > 0);
await check('作者可以替自己的文章加標籤', async () => (await as(A, `insert into public.post_tags values (${q2.id},1) returning *`)).rows.length === 1);
await check('不能替別人的文章加標籤', () => rejects(as(B, `insert into public.post_tags values (${s3.id},1)`)));
await check('一般會員不能刪除標籤', async () => { await as(B, `delete from public.tags where id=1`); return (await db.query('select count(*)::int n from public.tags')).rows[0].n === 1; });
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
