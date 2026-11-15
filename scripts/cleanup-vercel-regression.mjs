import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { databaseUrl, safeMessage } from './supabase-env.mjs';
import { databaseSsl } from '../src/lib/db/tls.mjs';

// No application behavior is tested against this connection. It is used solely
// to remove this run's individually recorded test fixtures; there is no delete UI.
// Never delete test accounts, change schema, disable RLS or touch unrelated data.
const state=JSON.parse(readFileSync(process.env.GREENTHUMB_TEST_STATE||'.local/vercel-regression-state.json','utf8'));
const uiFile=process.env.GREENTHUMB_TEST_UI||'.local/vercel-ui-fixtures.json';
const ui=existsSync(uiFile)?JSON.parse(readFileSync(uiFile,'utf8')):{posts:[],columns:[]};
const folder=process.env.GREENTHUMB_TEST_OUTPUT||'docs/testing/2026-11-15';
const accountIds=JSON.parse(readFileSync('.local/test-accounts.json','utf8')).accounts.map(a=>a.id);
const url=new URL(databaseUrl());const ssl=databaseSsl(url.href);
for(const name of ['sslmode','sslrootcert','sslcert','sslkey'])url.searchParams.delete(name);
const pool=new Pool({connectionString:url.href,ssl,max:1,connectionTimeoutMillis:12000,query_timeout:15000});
const counts={posts:0,columns:0,replies:0,drafts:0};
const markers=[state.run,ui.marker||'QA-UI-20261115'];
const marked=text=>typeof text==='string'&&markers.some(marker=>text.startsWith(marker));
try{
 const db=await pool.connect();
 try{
  await db.query('begin');
  for(const fixture of state.fixtures.replies){
   const table=fixture.kind==='post'?'replies':'column_replies';
   assert.ok(accountIds.includes(fixture.authorId)&&marked(fixture.body));
   const result=await db.query(`delete from public.${table} where id=$1 and author_id=$2 and body=$3 returning id`,[fixture.id,fixture.authorId,fixture.body]);counts.replies+=result.rowCount;
  }
  for(const [key,table] of [['posts','posts'],['columns','expert_columns']]){
   const fixtures=[...state.fixtures[key],...(ui[key]??[])];
   for(const fixture of fixtures){
    assert.ok(accountIds.includes(fixture.authorId));
    const lookup=key==='posts'&&!/^\d+$/.test(fixture.id)?'public_id':'id';
    const {rows}=await db.query(`select id,title,author_id from public.${table} where ${lookup}=$1 for update`,[fixture.id]);
    if(!rows.length)continue;
    assert.equal(rows[0].author_id,fixture.authorId);assert.ok(marked(rows[0].title),'Unexpected fixture title: do not remove');
    const replyTable=key==='posts'?'replies':'column_replies',foreignKey=key==='posts'?'post_id':'column_id';
    const replies=await db.query(`select id,author_id,body from public.${replyTable} where ${foreignKey}=$1`,[rows[0].id]);
    assert.ok(replies.rows.every(r=>accountIds.includes(r.author_id)&&marked(r.body)),'Unrelated reply present: preserve article');
    const removed=await db.query(`delete from public.${table} where id=$1 and author_id=$2 and title=$3 returning id`,[rows[0].id,fixture.authorId,rows[0].title]);counts[key]+=removed.rowCount;counts.replies+=replies.rowCount;
   }
  }
  for(const original of state.originals){
   const {rows}=await db.query('select kind,payload from public.member_drafts where user_id=$1 for update',[original.id]);
   for(const row of rows){
    if(!marked(row.payload.title))continue;
    const before=original.drafts[row.kind];
    if(before)await db.query('update public.member_drafts set payload=$1::jsonb where user_id=$2 and kind=$3',[JSON.stringify(before.payload),original.id,row.kind]);
    else await db.query('delete from public.member_drafts where user_id=$1 and kind=$2',[original.id,row.kind]);
    counts.drafts++;
   }
  }
  await db.query('commit');
  const remaining=[];
  for(const [key,table]of [['posts','posts'],['columns','expert_columns']])for(const fixture of [...state.fixtures[key],...(ui[key]??[])]){
   const lookup=key==='posts'&&!/^\d+$/.test(fixture.id)?'public_id':'id';
   const {rows}=await db.query(`select id from public.${table} where ${lookup}=$1`,[fixture.id]);if(rows.length)remaining.push(fixture.id);
  }
  assert.equal(remaining.length,0);
  const result={status:'PASS',cleanedAt:new Date().toISOString(),counts,remainingFixtures:remaining.length,accountsPreserved:true};
  writeFileSync(folder+'/cleanup-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(error){await db.query('rollback');throw error;}finally{db.release();}
}catch(error){console.error(safeMessage(error));process.exitCode=1;}finally{await pool.end();}
