import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const base='https://greenthumb-eta.vercel.app';
const accounts=JSON.parse(readFileSync('.local/test-accounts.json','utf8')).accounts;
const state=JSON.parse(readFileSync(process.env.GREENTHUMB_TEST_STATE||'.local/vercel-regression-state.json','utf8'));
const uiFile=process.env.GREENTHUMB_TEST_UI||'.local/vercel-ui-fixtures.json';
const ui=existsSync(uiFile)?JSON.parse(readFileSync(uiFile,'utf8')):{posts:[],columns:[]};
const folder=process.env.GREENTHUMB_TEST_OUTPUT||'docs/testing/2026-11-15';
const checks=[];
async function req(path,cookie='',body,expected=200){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();assert.equal(response.status,expected,path+': unexpected status');return {response,data};
}
for(let i=0;i<accounts.length;i++){
 const {response}=await req('/api/auth/sign-in/email','',{email:accounts[i].email,password:accounts[i].password});
 const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 try{
  const {data}=await req('/api/member-session',cookie);assert.equal(data.user.id,accounts[i].id);assert.equal(data.user.role,'member');assert.equal(data.user.name,state.originals[i].name);
  for(const kind of ['discussion','column'])assert.deepEqual((await req('/api/member-data?kind='+kind,cookie)).data.draft?.payload??null,state.originals[i].drafts[kind]?.payload??null);
  const bookmarks=(await req('/api/member-data',cookie)).data.bookmarks;assert.ok(!bookmarks.some(id=>[...state.fixtures.posts,...ui.posts].some(f=>f.id===id)));
  checks.push('會員 '+(i+1)+' 原暱稱、權限、兩種原草稿及收藏均已還原');
 }finally{await req('/api/auth/sign-out',cookie,{});assert.equal((await req('/api/member-session',cookie)).data.user,null);}
}
for(const fixture of [...state.fixtures.posts,...ui.posts])await req('/api/forum?id='+fixture.id,'',undefined,404);
for(const fixture of [...state.fixtures.columns,...ui.columns])await req('/api/expert-columns?id='+fixture.id,'',undefined,404);
checks.push(([...state.fixtures.posts,...ui.posts,...state.fixtures.columns,...ui.columns].length)+' 篇本次建立的文章／專欄均已從正式站 API 移除');
const forum=(await req('/api/forum')).data;assert.equal(forum.user,null);assert.ok(forum.posts.some(p=>p.title==='石蓮花種植入門：日照、澆水與盆土的照顧重點'));assert.ok(forum.posts.some(p=>p.title==='【請教】新手剛入坑，想詢問龍舌蘭與仙人掌的光照需求及澆水頻率？'));assert.ok(!forum.posts.some(p=>p.title.startsWith(state.run)||p.title.startsWith(ui.marker||'QA-UI-20261115')));
assert.equal((await req('/api/article-interactions?kind=editorial&id=balcony-field-notes')).data.replies.some(r=>r.body.startsWith(state.run)),false);
checks.push('既有兩篇討論仍可讀，編輯精選中本次回覆已清除');
const report={base,verifiedAt:new Date().toISOString(),status:'PASS',checks};writeFileSync(folder+'/restoration-verification.json',JSON.stringify(report,null,2)+'\n');
for(const check of checks)console.log('PASS '+check);
