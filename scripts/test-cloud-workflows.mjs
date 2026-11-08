import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {databaseUrl,safeMessage} from './supabase-env.mjs';

// Disposable, confirmed Auth fixtures exercise real GoTrue sessions without sending mail.
// Never alter an existing account. Every fixture UUID and editorial slug is generated here.
const sql=postgres(databaseUrl(),{ssl:'require',max:1,prepare:false,connect_timeout:12});
const ids=[randomUUID(),randomUUID()],slug='cloud-check-'+randomUUID();
const password=randomBytes(24).toString('base64url');
const emails=ids.map(id=>'cloud-check-'+id+'@example.invalid');
const base='http://127.0.0.1:3000';
function client(){
  const cookies=new Map();
  return async(path,body,status=200)=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:base}:{}),Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    for(const cookie of response.headers.getSetCookie()){const first=cookie.split(';')[0],at=first.indexOf('=');if(/max-age=0/i.test(cookie))cookies.delete(first.slice(0,at));else cookies.set(first.slice(0,at),first.slice(at+1));}
    const result=await response.json();
    assert.equal(response.status,status,path+': '+(result.error??'unexpected response'));
    return result;
  };
}
try{
  await sql.begin(async tx=>{
    for(let i=0;i<ids.length;i++){
      await tx`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
        values ('00000000-0000-0000-0000-000000000000',${ids[i]},'authenticated','authenticated',${emails[i]},extensions.crypt(${password},extensions.gen_salt('bf',10)),now(),'','','','',
        '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"雲端流程驗證"}'::jsonb,now(),now())`;
      await tx`insert into auth.identities (user_id,provider_id,identity_data,provider,created_at,updated_at)
        values (${ids[i]},${ids[i]},${tx.json({sub:ids[i],email:emails[i],email_verified:true,phone_verified:false})},'email',now(),now())`;
    }
    await tx`insert into public.editorial_articles (slug,title,excerpt,body,category,published,sort_order)
      values (${slug},'雲端內容來源驗證','臨時測試內容','## 臨時專欄\n\n僅供來源驗證。','測試',true,-9999)`;
  });
  const a=client(),b=client(),aSecondSession=client();
  for(const [request,i] of [[a,0],[b,1],[aSecondSession,0]]){const result=await request('/api/forum',{action:'login',email:emails[i],password});assert.equal(result.user.id,ids[i]);}
  console.log('PASS real Supabase Auth sessions');
  const discussion={title:'雲端草稿',body:'**跨裝置內容**',category:'觀葉植物',images:[],font:'serif',fontSize:18};
  await a('/api/member-data',{action:'saveDraft',kind:'discussion',payload:discussion});
  await a('/api/member-data',{action:'saveDraft',kind:'discussion',payload:{...discussion,title:'再次儲存'}});
  const reloaded=await aSecondSession('/api/member-data?kind=discussion');assert.equal(reloaded.draft.payload.title,'再次儲存');
  assert.equal((await b('/api/member-data?kind=discussion')).draft,null);
  console.log('PASS cloud drafts: save twice, separate session restore, owner isolation');
  const {post}=await a('/api/forum',{action:'publish',...discussion},201);
  assert.equal(post.font,'serif');assert.equal(post.fontSize,18);
  assert.equal((await a('/api/member-data?kind=discussion')).draft,null);
  await b('/api/forum',{action:'publish',...discussion,id:post.id},403);
  console.log('PASS publish clears draft atomically and rejects another author');
  await a('/api/member-data',{action:'bookmark',postId:post.id,saved:true});
  await a('/api/member-data',{action:'bookmark',postId:post.id,saved:true});
  assert.ok((await aSecondSession('/api/member-data')).bookmarks.includes(post.id));
  assert.equal((await b('/api/member-data')).bookmarks.length,0);
  await aSecondSession('/api/member-data',{action:'bookmark',postId:post.id,saved:false});
  assert.equal((await a('/api/member-data')).bookmarks.includes(post.id),false);
  console.log('PASS cloud bookmarks: idempotence, separate session restore, remove, owner isolation');
  const column={title:'在地專欄驗證',excerpt:'測試',body:'## 內容',county:'臺北市',regionCode:'63000030'};
  await a('/api/member-data',{action:'saveDraft',kind:'column',payload:column});
  const {column:published}=await a('/api/expert-columns',column,201);
  assert.equal((await a('/api/member-data?kind=column')).draft,null);
  assert.equal((await aSecondSession('/api/expert-columns?id='+published.id)).column.regionCode,'63000030');
  console.log('PASS expert column drafts, publish, and saved region');
  for(const path of ['/','/columns/'+slug]){const response=await fetch(base+path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('雲端內容來源驗證'),path);}
  console.log('PASS editorial content renders from live database without rebuilding');
  await a('/api/forum',{action:'logout'});assert.equal((await a('/api/forum')).user,null);
}catch(error){console.error(safeMessage(error));process.exitCode=1;}
finally{
  try{
    await sql.begin(async tx=>{
      await tx`delete from public.editorial_articles where slug=${slug}`;
      for(const id of ids){await tx`delete from public.posts where author_id=${id}`;await tx`delete from public.expert_columns where author_id=${id}`;await tx`delete from auth.users where id=${id}`;}
    });
    console.log('PASS disposable accounts and content removed');
  }catch(error){console.error('Fixture cleanup failed: '+safeMessage(error));process.exitCode=1;}
  await sql.end({timeout:3});
}
