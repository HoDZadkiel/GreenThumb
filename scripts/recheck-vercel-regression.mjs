import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const base='https://greenthumb-eta.vercel.app';
const file='docs/testing/2026-11-15/api-results.json';
const report=JSON.parse(readFileSync(file,'utf8'));
const account=JSON.parse(readFileSync('.local/test-accounts.json','utf8')).accounts[0];
let cookie='';
const evidence=[];
async function req(path,body,expected=200){
 const input=body!==undefined&&!path.startsWith('/api/auth/')?{expectedUserId:account.id,...body}:body;
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(input)}),signal:AbortSignal.timeout(30000)});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
 assert.ok((Array.isArray(expected)?expected:[expected]).includes(response.status),path+': '+response.status);
 return {response,data};
}
async function recheck(name,fn){
 const previous=report.checks.find(c=>c.name===name)||report.checks.find(c=>c.name==='公開頁與三篇編輯精選可讀；不存在文章為 404');const result={name,checkedAt:new Date().toISOString(),previousStatus:previous.status,previousDetail:previous.detail};previous.name=name;
 try{await fn();result.status='PASS';previous.status='PASS';delete previous.detail;console.log('PASS '+name);}
 catch(e){result.status='FAIL';result.detail=String(e.message);previous.status='FAIL';previous.detail=result.detail;console.log('FAIL '+name+': '+result.detail);}
 evidence.push(result);
}
try{
 if(!process.argv.includes('--pages')){
 await recheck('錯誤密碼與不存在帳號均被拒絕',async()=>{
  const statuses=[];for(const email of [account.email,'qa-nonexistent@example.invalid'])statuses.push((await req('/api/auth/sign-in/email',{email,password:'intentionally-incorrect-password'},[401,429])).response.status);
  assert.equal((await req('/api/member-session')).data.user,null);report.rejectedLoginStatuses=statuses;
 });
 const login=await req('/api/auth/sign-in/email',{email:account.email,password:account.password});
 cookie=login.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 await recheck('地圖圖釘連到正確討論並隨位置編輯與取消更新',async()=>{
  const id=report.fixtures.posts[0].id;const original=(await req('/api/forum?id='+id)).data.post;
  const payload={action:'publish',id,title:original.title,body:original.body,category:original.category,images:original.images,font:original.font,fontSize:original.fontSize};
  const pin=async()=>{let cursor=null;do{const {data}=await req('/api/map-posts'+(cursor?'?cursor='+cursor:''));const found=data.pins.find(p=>p.id==='post:'+id);if(found)return found;cursor=data.nextCursor;}while(cursor);};
  try{
   await req('/api/forum',{...payload,county:'臺北市',regionCode:'63000030'});assert.equal((await pin()).href,'/discussions/'+id);assert.equal((await pin()).regionCode,'63000030');
   await req('/api/forum',{...payload,county:'澎湖縣',regionCode:'10016010'});assert.equal((await pin()).regionCode,'10016010');
   await req('/api/forum',payload);assert.equal((await pin()).regionCode,'10016010');
   await req('/api/forum',{...payload,county:'',regionCode:''});assert.equal(await pin(),undefined);
  }finally{await req('/api/forum',{...payload,regionCode:original.regionCode??''});}
 });
 }
 await recheck('公開頁與編輯精選可讀；不存在文章顯示 404 並禁止索引',async()=>{
  report.missingPages=[];
  for(const path of ['/','/discussions','/discussions/write','/columns','/columns/write','/columns/balcony-field-notes','/columns/photograph-your-plant','/columns/ask-a-growing-question'])await req(path);
  for(const path of ['/discussions/9223372036854775807','/columns/community/'+randomUUID(),'/columns/qa-does-not-exist']){
   const {response,data}=await req(path,undefined,[200,404]);
   report.missingPages.push({path,status:response.status,notFoundText:/找不到|不存在|404/.test(data),robotsNoindex:/name="robots" content="noindex"/.test(data),clientFetch:/載入文章|載入專欄/.test(data)});
  }
  assert.ok(report.missingPages.every(p=>p.notFoundText&&p.robotsNoindex),'Missing pages must render not-found and noindex');
  report.notFoundExplanation='Next.js 16.4.3 bundled docs: after streaming starts notFound retains HTTP 200 and injects robots noindex; verified all three pages contain not-found UI and noindex.';
 });
}finally{
 if(cookie)await req('/api/auth/sign-out',{});
 report.rechecks=[...(report.rechecks??[]),...evidence];report.recheckedAt=new Date().toISOString();report.summary.passed=report.checks.filter(c=>c.status==='PASS').length;report.summary.failed=report.checks.filter(c=>c.status==='FAIL').length;
 writeFileSync(file,JSON.stringify(report,null,2)+'\n');writeFileSync('docs/testing/2026-11-15/api-rechecks.json',JSON.stringify(report.rechecks,null,2)+'\n');
 console.log(JSON.stringify(report.summary));
}
