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
const base=process.argv[2]??'http://127.0.0.1:3000';
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
  await a('/api/member-data',{action:'saveDraft',kind:'discussion',payload:{...discussion,county:'臺北市',regionCode:''}});
  assert.equal((await aSecondSession('/api/member-data?kind=discussion')).draft.payload.county,'臺北市');
  await a('/api/member-data',{action:'saveDraft',kind:'discussion',payload:discussion});
  await a('/api/member-data',{action:'saveDraft',kind:'discussion',payload:{...discussion,title:'再次儲存'}});
  const reloaded=await aSecondSession('/api/member-data?kind=discussion');assert.equal(reloaded.draft.payload.title,'再次儲存');
  assert.equal((await b('/api/member-data?kind=discussion')).draft,null);
  console.log('PASS cloud drafts: save twice, separate session restore, owner isolation');
  const {post}=await a('/api/forum',{action:'publish',...discussion},201);
  assert.equal(post.font,'serif');assert.equal(post.fontSize,18);
  assert.equal(post.regionCode,null);
  const mapPins=async()=>{
    const pins=[];let cursor=null;
    do{const page=await a('/api/map-posts'+(cursor?'?cursor='+cursor:''));pins.push(...page.pins);cursor=page.nextCursor;}while(cursor!==null);
    return pins;
  };
  const findPin=async()=> (await mapPins()).find(pin=>pin.id==='post:'+post.id);
  assert.equal(await findPin(),undefined);
  await a('/api/forum',{action:'publish',...discussion,id:post.id,county:'臺北市',regionCode:''},400);
  await a('/api/forum',{action:'publish',...discussion,id:post.id,county:'臺南市',regionCode:'63000030'},400);
  await a('/api/forum',{action:'publish',...discussion,id:post.id,regionCode:'fake'},400);
  await a('/api/forum',{action:'publish',...discussion,id:post.id,county:'臺北市',regionCode:'63000030'});
  assert.equal((await findPin()).href,'/discussions/'+post.id);
  assert.equal((await findPin()).regionCode,'63000030');
  const locatedPost=(await aSecondSession('/api/forum?id='+post.id)).post;
  assert.equal(locatedPost.regionCode,'63000030');assert.equal(locatedPost.region,'north');
  await b('/api/forum',{action:'publish',...discussion,id:post.id,regionCode:'10016010'},403);
  assert.equal((await findPin()).regionCode,'63000030');
  await a('/api/forum',{action:'publish',...discussion,id:post.id,county:'澎湖縣',regionCode:'10016010'});
  assert.equal((await findPin()).regionCode,'10016010');
  assert.equal((await aSecondSession('/api/forum?id='+post.id)).post.region,'island');
  await a('/api/forum',{action:'publish',...discussion,id:post.id}); // Older callers preserve the district.
  assert.equal((await findPin()).regionCode,'10016010');
  await a('/api/forum',{action:'publish',...discussion,id:post.id,county:'',regionCode:''});
  assert.equal(await findPin(),undefined);
  assert.equal((await aSecondSession('/api/forum?id='+post.id)).post.regionCode,null);
  await a('/api/map-posts?cursor=invalid',undefined,400);
  console.log('PASS optional locations: unfinished drafts, no-location publish, pin opt-in, edit, author permissions and removal');
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
  const visitor=client();
  for(const [kind,id,path] of [['post',post.id,'/discussions/'+post.id],['column',published.id,'/columns/community/'+published.id],['editorial',slug,'/columns/'+slug]]){
    const target={kind,id},query=new URLSearchParams(target).toString(),endpoint='/api/article-interactions';
    const initial=await visitor(endpoint+'?'+query);
    assert.equal(initial.replyCount,0);assert.equal(initial.likeCount,0);assert.equal(initial.liked,false);
    await visitor(endpoint,{...target,action:'reply',body:'訪客回應'},401);
    await visitor(endpoint,{...target,action:'like',liked:true},401);
    await a(endpoint,{...target,action:'reply',body:'   '},400);
    await a(endpoint,{...target,action:'reply',body:'字'.repeat(2001)},400);
    await a(endpoint,{...target,action:'like',liked:'true'},400);
    for(let repeat=0;repeat<2;repeat++)assert.equal((await a(endpoint,{...target,action:'like',liked:true})).likeCount,1);
    assert.equal((await aSecondSession(endpoint+'?'+query)).liked,true);
    assert.equal((await b(endpoint+'?'+query)).liked,false);
    assert.equal((await b(endpoint,{...target,action:'like',liked:true})).likeCount,2);
    assert.equal((await a(endpoint,{...target,action:'like',liked:false})).likeCount,1);
    const {reply}=await b(endpoint,{...target,action:'reply',body:'分享我的植物經驗',authorId:ids[0]},201);
    assert.equal(reply.authorId,ids[1]);
    const state=await visitor(endpoint+'?'+query);
    assert.equal(state.replyCount,1);assert.equal(state.replies[0].body,'分享我的植物經驗');assert.equal(state.likeCount,1);
    const response=await fetch(base+path);assert.equal(response.status,200);const html=await response.text();
    assert.ok(html.includes('article-responses'),path);assert.ok(html.includes('og:type'),path);
  }
  console.log('PASS all article pages, real replies, idempotent likes, separate session state, anonymous read and write protection');
  // Check pagination and locked/deleted parents through the HTTP API as well.
  await sql`insert into public.replies (post_id,author_id,body) select ${post.id},${ids[1]},'分頁回應 '||n from generate_series(1,31) as n`;
  const page=await visitor('/api/article-interactions?kind=post&id='+post.id);
  assert.equal(page.replies.length,30);assert.equal(page.replyCount,32);assert.ok(page.nextCursor);
  const next=await visitor('/api/article-interactions?kind=post&id='+post.id+'&cursor='+page.nextCursor);
  assert.equal(next.replies.length,2);assert.equal(next.nextCursor,null);
  assert.ok(!page.replies.some(reply=>next.replies.some(item=>item.id===reply.id)));
  const refreshedPost=(await visitor('/api/forum?id='+post.id)).post;
  assert.equal(refreshedPost.replyCount,32);assert.equal(refreshedPost.likeCount,1);
  await sql`update public.posts set is_locked=true where id=${post.id}`;
  assert.equal((await visitor('/api/article-interactions?kind=post&id='+post.id)).canReply,false);
  await a('/api/article-interactions',{kind:'post',id:post.id,action:'reply',body:'已鎖定'},403);
  await sql`update public.posts set deleted_at=now() where id=${post.id}`;
  await sql`update public.posts set region_code='63000030' where id=${post.id}`;
  assert.equal(await findPin(),undefined);
  await visitor('/api/article-interactions?kind=post&id='+post.id,undefined,404);
  await a('/api/article-interactions',{kind:'post',id:post.id,action:'like',liked:true},404);
  await visitor('/api/article-interactions?kind=post&id=invalid',undefined,400);
  await visitor('/api/article-interactions?kind=post&id='+post.id+'&cursor=invalid',undefined,400);
  await sql`update public.editorial_articles set published=false where slug=${slug}`;
  await visitor('/api/article-interactions?kind=editorial&id='+slug,undefined,404);
  await a('/api/article-interactions',{kind:'editorial',id:slug,action:'reply',body:'已下架'},404);
  await sql`update public.editorial_articles set published=true where slug=${slug}`;
  console.log('PASS pagination, forum counters, locked/deleted posts and unpublished editorial protection');
  for(const path of ['/','/columns/'+slug]){const response=await fetch(base+path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('雲端內容來源驗證'),path);}
  console.log('PASS editorial content renders from live database without rebuilding');
  await a('/api/forum',{action:'logout'});assert.equal((await a('/api/forum')).user,null);
}catch(error){console.error(safeMessage(error));process.exitCode=1;}
finally{
  try{
    await sql.begin(async tx=>{
      await tx`delete from public.column_replies where author_id=any(${ids}::uuid[])`;
      await tx`delete from public.editorial_articles where slug=${slug}`;
      for(const id of ids){await tx`delete from public.posts where author_id=${id}`;await tx`delete from public.expert_columns where author_id=${id}`;await tx`delete from auth.users where id=${id}`;}
    });
    console.log('PASS disposable accounts and content removed');
  }catch(error){console.error('Fixture cleanup failed: '+safeMessage(error));process.exitCode=1;}
  await sql.end({timeout:3});
}
