import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// This runner only sends application requests to the production Vercel origin.
// Test credentials and recoverable original drafts stay in gitignored .local.
const base = 'https://greenthumb-eta.vercel.app';
const accounts = JSON.parse(readFileSync('.local/test-accounts.json', 'utf8')).accounts;
const run = 'QA-20261115-' + randomUUID().slice(0, 8);
const folder = 'docs/testing/2026-11-15';
mkdirSync(folder, { recursive: true });
const stateFile = '.local/vercel-regression-state.json';
const report = { base, run, startedAt: new Date().toISOString(), checks: [], fixtures: { posts: [], columns: [], replies: [] }, restoration: [] };
const originals = [];
function persist() {
  writeFileSync(stateFile, JSON.stringify({ run, originals, fixtures: report.fixtures }, null, 2));
  writeFileSync(folder + '/api-results.json', JSON.stringify(report, null, 2) + '\n');
}
async function check(name, fn) {
  try { await fn(); report.checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { report.checks.push({ name, status: 'FAIL', detail: String(e.message).slice(0, 500) }); console.log('FAIL ' + name + ': ' + String(e.message).slice(0, 200)); }
  persist();
}
function client() {
  const cookies = new Map();
  let userId=null;
  return {
    async req(path, body, status = 200, extra = {}) {
      const headers = { Origin: base, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Cookie: [...cookies].map(([k,v]) => k + '=' + v).join('; '), ...extra.headers };
      const input=body!==undefined&&!path.startsWith('/api/auth/')?{expectedUserId:userId,...body}:body;
      const response = await fetch(base + path, { method: body !== undefined ? 'POST' : 'GET', ...extra, headers, ...(body !== undefined ? { body: JSON.stringify(input) } : {}), redirect: 'manual', signal: AbortSignal.timeout(30000) });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], at = pair.indexOf('=');
        if (/max-age=0/i.test(cookie)) cookies.delete(pair.slice(0, at));
        else cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      if(path==='/api/auth/sign-in/email'&&response.ok)userId=data.user.id;
      if(path==='/api/auth/sign-out'&&response.ok)userId=null;
      assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), path + ': expected ' + JSON.stringify(status) + ', got ' + response.status + ': ' + (typeof data === 'object' ? (data?.error ?? data?.message ?? '') : text.slice(0, 100)));
      return { data, headers: response.headers, status: response.status };
    },
    cookie() { return [...cookies].map(([k,v]) => k + '=' + v).join('; '); },
  };
}
const [a,b,c,a2,g] = Array.from({length:5}, client);
const members = [a,b,c];
const draft = (i,kind) => kind === 'discussion'
  ? { title: run + '-會員' + (i+1), body: run + '-private-' + i, category: '觀葉植物', images: [], font: 'serif', fontSize: 18, county: '臺北市', regionCode: '' }
  : { title: run + '-專欄' + (i+1), body: run + '-column-private-' + i, excerpt: '測試專欄簡介', county: '臺北市', regionCode: '63000030' };
const postPayload = { action: 'publish', title: run + '-討論', body: '## Vercel 正式站驗收\n\n**粗體**與植物照護心得。\n\n<script>window.qaXss=1</script>\n\n[測試連結](javascript:alert(1))', category: '觀葉植物', images: [], font: 'serif', fontSize: 18, county: '', regionCode: '' };
const columnPayload = { title: run + '-專欄', excerpt: '正式站功能驗收暫存內容', body: '## 在地種植\n\n**Markdown** 測試內容。', county: '臺北市', regionCode: '63000030' };
let post, otherPost, column, otherColumn;
try {
  await check('訪客 session 與啟用的登入方式', async()=>{const {data}=await g.req('/api/member-session');assert.equal(data.user,null);assert.equal(data.auth.password,true);report.auth=data.auth;});
  await check('訪客不能儲存草稿、收藏、修改暱稱、發文或發專欄', async()=>{
    for(const body of [{action:'saveDraft',kind:'discussion',payload:draft(0,'discussion')},{action:'bookmark',postId:'3',saved:true},{action:'profile',name:'blocked'}])await g.req('/api/member-data',body,401);
    await g.req('/api/forum',postPayload,401);await g.req('/api/expert-columns',columnPayload,401);
  });
  for(let i=0;i<3;i++) await check('會員 '+(i+1)+' 帳密登入、cookie 安全與一般會員身分',async()=>{
    const {headers}=await members[i].req('/api/auth/sign-in/email',{email:accounts[i].email,password:accounts[i].password});
    assert.ok(headers.getSetCookie().some(v=>/Secure/i.test(v)&&/HttpOnly/i.test(v)&&/SameSite=Lax/i.test(v)));assert.match(headers.get('cache-control'),/no-store/);
    const {data}=await members[i].req('/api/member-session');assert.equal(data.user.id,accounts[i].id);assert.equal(data.user.role,'member');
    originals[i]={ id:accounts[i].id, name:data.user.name, drafts:{} };
    for(const kind of ['discussion','column']) originals[i].drafts[kind]=(await members[i].req('/api/member-data?kind='+kind)).data.draft;
  });
  assert.equal(originals.length,3,'all accounts must log in before mutation');
  await a2.req('/api/auth/sign-in/email',{email:accounts[0].email,password:accounts[0].password});
  await check('錯誤密碼與不存在帳號均被拒絕',async()=>{
    report.rejectedLoginStatuses=[];
    for(const email of [accounts[0].email,'qa-nonexistent@example.invalid'])report.rejectedLoginStatuses.push((await g.req('/api/auth/sign-in/email',{email,password:'intentionally-incorrect-password'},[401,429])).status);
    assert.equal((await g.req('/api/member-session')).data.user,null);
  });
  await check('公開帳密註冊關閉',()=>g.req('/api/auth/sign-up/email',{email:'qa-nonexistent@example.invalid',password:'intentionally-unused-password',name:'unused'},404));
  await check('跨來源登入與會員寫入被拒絕',async()=>{
    await g.req('/api/auth/sign-in/email',{email:'unused@example.invalid',password:'unused'},403,{headers:{Origin:'https://example.invalid'}});
    await a.req('/api/member-data',{action:'profile',name:'blocked'},403,{headers:{Origin:'https://example.invalid'}});
  });
  for(const kind of ['discussion','column']) {
    await check(kind+' 三帳號草稿各自儲存、更新及交錯讀取隔離',async()=>{
      for(let i=0;i<3;i++)await members[i].req('/api/member-data',{action:'saveDraft',kind,payload:draft(i,kind),userId:accounts[(i+1)%3].id});
      for(let round=0;round<2;round++)for(let i=2;i>=0;i--){const {data,headers}=await members[i].req('/api/member-data?kind='+kind+'&userId='+accounts[(i+1)%3].id);assert.equal(data.draft.payload.body,draft(i,kind).body);assert.match(headers.get('cache-control'),/private, no-store/);}
      assert.equal((await g.req('/api/member-data?kind='+kind)).data.draft,null);
      assert.equal((await a2.req('/api/member-data?kind='+kind)).data.draft.payload.body,draft(0,kind).body);
    });
    await check(kind+' 刪除草稿只影響自己',async()=>{
      await b.req('/api/member-data',{action:'deleteDraft',kind,userId:accounts[0].id});
      assert.equal((await b.req('/api/member-data?kind='+kind)).data.draft,null);
      assert.equal((await a.req('/api/member-data?kind='+kind)).data.draft.payload.body,draft(0,kind).body);
      await b.req('/api/member-data',{action:'saveDraft',kind,payload:draft(1,kind)});
    });
  }
  await check('討論草稿容許尚未選完行政區',async()=>assert.equal((await a.req('/api/member-data?kind=discussion')).data.draft.payload.county,'臺北市'));
  await check('無效草稿類型、過長草稿與錯誤地區被拒絕',async()=>{
    await a.req('/api/member-data?kind=invalid',undefined,400);
    for(const payload of [{...draft(0,'discussion'),body:'字'.repeat(5001)},{...draft(0,'discussion'),regionCode:'invalid'}])await a.req('/api/member-data',{action:'saveDraft',kind:'discussion',payload},400);
  });
  await check('會員 1 發表討論、作者不可冒用、發表自動清除自己的草稿',async()=>{
    post=(await a.req('/api/forum',{...postPayload,authorId:accounts[1].id,userId:accounts[1].id,postType:'guide',isLocked:true},201)).data.post;
    report.fixtures.posts.push({id:post.id,authorId:accounts[0].id});persist();
    assert.equal(post.authorId,accounts[0].id);assert.equal(post.font,'serif');assert.equal(post.fontSize,18);assert.equal(post.regionCode,null);
    assert.equal((await a.req('/api/member-data?kind=discussion')).data.draft,null);
    assert.ok((await b.req('/api/member-data?kind=discussion')).data.draft);
  });
  assert.ok(post,'primary fixture required');
  await check('會員 2 發表自己的討論',async()=>{otherPost=(await b.req('/api/forum',{...postPayload,title:run+'-會員2討論',body:'會員 2 所有權測試',category:'多肉植物',county:'澎湖縣',regionCode:'10016010'},201)).data.post;report.fixtures.posts.push({id:otherPost.id,authorId:accounts[1].id});persist();});
  await check('其他兩會員不能編輯會員 1 討論，會員 1 不能編輯會員 2 討論',async()=>{
    for(const request of [b,c])await request.req('/api/forum',{...postPayload,id:post.id,title:run+'-unauthorized'},403);
    await a.req('/api/forum',{...postPayload,id:otherPost.id},403);
    assert.equal((await g.req('/api/forum?id='+post.id)).data.post.title,post.title);
  });
  await check('作者編輯格式、分類、文字與所在地並跨 session 讀回',async()=>{
    post=(await a.req('/api/forum',{...postPayload,id:post.id,title:run+'-討論修訂',category:'香草植物',county:'臺北市',regionCode:'63000030'},200)).data.post;
    assert.equal(post.region,'north');assert.equal((await a2.req('/api/forum?id='+post.id)).data.post.title,post.title);
  });
  await check('地圖圖釘連到正確討論並隨位置編輯與取消更新',async()=>{
    const pin=async()=>{let cursor=null;const pins=[];do{const {data}=await g.req('/api/map-posts'+(cursor?'?cursor='+cursor:''));pins.push(...data.pins);cursor=data.nextCursor;}while(cursor);return pins.find(v=>v.id==='post:'+post.id);};
    assert.equal((await pin()).href,'/discussions/'+post.id);assert.equal((await pin()).regionCode,'63000030');
    await a.req('/api/forum',{...postPayload,id:post.id,county:'澎湖縣',regionCode:'10016010'});assert.equal((await pin()).regionCode,'10016010');
    const withoutLocation={...postPayload};delete withoutLocation.county;delete withoutLocation.regionCode;
    await a.req('/api/forum',{...withoutLocation,id:post.id});assert.equal((await pin()).regionCode,'10016010');
    await a.req('/api/forum',{...postPayload,id:post.id,county:'',regionCode:''});assert.equal(await pin(),undefined);
    post=(await a.req('/api/forum',{...postPayload,id:post.id,county:'臺北市',regionCode:'63000030'})).data.post;
  });
  await check('討論欄位限制與位置錯配被拒絕',async()=>{
    for(const change of [{title:''},{title:'字'.repeat(101)},{body:''},{body:'字'.repeat(5001)},{category:'invalid'},{font:'invalid'},{fontSize:100},{images:['javascript:alert(1)']},{images:['https://i.ibb.co.evil.invalid/x.jpg']},{images:Array(6).fill('https://i.ibb.co/fixture.webp')},{county:'臺北市',regionCode:''},{county:'臺南市',regionCode:'63000030'},{regionCode:'invalid'},{id:'-1'}])await a.req('/api/forum',{...postPayload,...change},400);
  });
  await check('ImgBB 圖片來源可儲存於文章並讀回',async()=>{
    const images=['https://i.ibb.co/qa-fixture.webp'];const saved=(await a.req('/api/forum',{...postPayload,id:post.id,images})).data.post;assert.deepEqual(saved.images,images);
    post=(await a.req('/api/forum',{...postPayload,id:post.id,county:'臺北市',regionCode:'63000030'})).data.post;
  });
  await check('收藏冪等、同會員另一 session 可見、其他帳號及訪客不可見',async()=>{
    for(let repeat=0;repeat<2;repeat++)await a.req('/api/member-data',{action:'bookmark',postId:post.id,saved:true,userId:accounts[1].id});
    assert.ok((await a2.req('/api/member-data')).data.bookmarks.includes(post.id));
    for(const req of [b,c,g])assert.equal((await req.req('/api/member-data?userId='+accounts[0].id)).data.bookmarks.includes(post.id),false);
    await b.req('/api/member-data',{action:'bookmark',postId:post.id,saved:false,userId:accounts[0].id});
    assert.ok((await a.req('/api/member-data')).data.bookmarks.includes(post.id));
    await a2.req('/api/member-data',{action:'bookmark',postId:post.id,saved:false});assert.equal((await a.req('/api/member-data')).data.bookmarks.includes(post.id),false);
  });
  await check('收藏無效文章編號與錯誤狀態被拒絕',async()=>{for(const body of [{postId:'invalid',saved:true},{postId:post.id,saved:'true'}])await a.req('/api/member-data',{action:'bookmark',...body},400);});
  for(let i=0;i<2;i++)await check('會員 '+(i+1)+' 發專欄、作者不可冒用、自動清草稿',async()=>{
    const col=(await members[i].req('/api/expert-columns',{...columnPayload,title:run+'-會員'+(i+1)+'專欄',authorId:accounts[(i+1)%3].id},201)).data.column;
    if(i===0)column=col;else otherColumn=col;report.fixtures.columns.push({id:col.id,authorId:accounts[i].id});persist();
    assert.equal(col.authorId,accounts[i].id);assert.equal((await members[i].req('/api/member-data?kind=column')).data.draft,null);
  });
  await check('專欄雙向越權編輯均被拒絕且內容不變',async()=>{
    for(const req of [b,c])await req.req('/api/expert-columns',{...columnPayload,id:column.id,title:'unauthorized'},403);
    await a.req('/api/expert-columns',{...columnPayload,id:otherColumn.id},403);
    assert.equal((await g.req('/api/expert-columns?id='+column.id)).data.column.title,column.title);
  });
  await check('專欄作者可編輯內容與行政區',async()=>{
    column=(await a.req('/api/expert-columns',{...columnPayload,id:column.id,title:run+'-專欄修訂',county:'澎湖縣',regionCode:'10016010'})).data.column;
    assert.equal(column.regionCode,'10016010');assert.equal((await a2.req('/api/expert-columns?id='+column.id)).data.column.title,column.title);
  });
  await check('專欄必填、字數及行政區驗證',async()=>{
    for(const change of [{title:''},{title:'字'.repeat(101)},{excerpt:''},{excerpt:'字'.repeat(201)},{body:''},{body:'字'.repeat(5001)},{regionCode:'invalid'},{id:'invalid'}])await a.req('/api/expert-columns',{...columnPayload,...change},400);
  });
  await check('舊分頁身分或缺少預期會員的寫入被拒絕且不改變新會員草稿',async()=>{
    const before={};for(const kind of ['discussion','column'])before[kind]=(await b.req('/api/member-data?kind='+kind)).data.draft;
    for(const expectedUserId of [accounts[0].id,undefined]){
      for(const kind of ['discussion','column']){
        await b.req('/api/member-data',{expectedUserId,action:'saveDraft',kind,payload:draft(0,kind)},409);
        await b.req('/api/member-data',{expectedUserId,action:'deleteDraft',kind},409);
      }
      await b.req('/api/member-data',{expectedUserId,action:'profile',name:'不應修改'},409);
      await b.req('/api/member-data',{expectedUserId,action:'bookmark',postId:post.id,saved:true},409);
      await b.req('/api/forum',{...postPayload,expectedUserId},409);
      await b.req('/api/expert-columns',{...columnPayload,expectedUserId},409);
      for(const action of [{action:'reply',body:'不應回覆'},{action:'like',liked:true}])await b.req('/api/article-interactions',{kind:'post',id:post.id,...action,expectedUserId},409);
    }
    for(const kind of ['discussion','column'])assert.deepEqual((await b.req('/api/member-data?kind='+kind)).data.draft,before[kind]);
    assert.equal((await b.req('/api/member-session')).data.user.name,originals[1].name);
  });
  for(const [kind,id,path] of [['post',post.id,'/discussions/'+post.id],['column',column.id,'/columns/community/'+column.id],['editorial','balcony-field-notes','/columns/balcony-field-notes']]) {
    const query='/api/article-interactions?'+new URLSearchParams({kind,id});
    const target={kind,id};
    const initial=(await g.req(query)).data;
    await check(kind+' 訪客可閱讀但不能按讚或回覆',async()=>{assert.equal(initial.liked,false);await g.req('/api/article-interactions',{...target,action:'like',liked:true},401);await g.req('/api/article-interactions',{...target,action:'reply',body:'blocked'},401);});
    await check(kind+' 無效互動輸入被拒絕',async()=>{
      for(const body of [{action:'reply',body:'  '},{action:'reply',body:'字'.repeat(2001)},{action:'like',liked:'true'},{action:'unknown'}])await a.req('/api/article-interactions',{...target,...body},400);
    });
    const oldLikes = (await Promise.all([a,b,c].map(async req=>(await req.req(query)).data))).map(x=>x.liked);
    try {
      await check(kind+' 個人按讚隔離、冪等及取消不影響其他人',async()=>{
        for(const req of [a,b,c])await req.req('/api/article-interactions',{...target,action:'like',liked:false});
        const baseline=(await g.req(query)).data.likeCount;
        for(let n=0;n<2;n++)assert.equal((await a.req('/api/article-interactions',{...target,action:'like',liked:true,userId:accounts[1].id})).data.likeCount,baseline+1);
        assert.equal((await a2.req(query)).data.liked,true);assert.equal((await b.req(query)).data.liked,false);assert.equal((await c.req(query)).data.liked,false);
        await b.req('/api/article-interactions',{...target,action:'like',liked:true});
        assert.equal((await c.req('/api/article-interactions',{...target,action:'like',liked:false,userId:accounts[0].id})).data.likeCount,baseline+2);
        assert.equal((await a.req('/api/article-interactions',{...target,action:'like',liked:false})).data.likeCount,baseline+1);
      });
    } finally {for(let i=0;i<3;i++)await members[i].req('/api/article-interactions',{...target,action:'like',liked:oldLikes[i]});}
    await check(kind+' 回覆身分不可冒用、公開顯示及正確計數',async()=>{
      const body=run+'-reply-'+kind+' <script>alert(1)</script>';
      const reply=(await b.req('/api/article-interactions',{...target,action:'reply',body,authorId:accounts[0].id},201)).data.reply;
      report.fixtures.replies.push({kind,id:reply.id,authorId:accounts[1].id,body});persist();assert.equal(reply.authorId,accounts[1].id);
      const data=(await g.req(query)).data;assert.equal(data.replyCount,initial.replyCount+1);assert.ok(data.replies.some(v=>v.id===reply.id&&v.body===body));
    });
    await check(kind+' 閱讀頁、SEO 與互動區域',async()=>{const {data}=await g.req(path);assert.equal(typeof data,'string');assert.ok(data.includes('article-responses'));assert.ok(data.includes('og:type'));assert.ok(data.includes('<title>'));assert.ok(!data.includes('<script>window.qaXss=1</script>'));});
  }
  await check('回覆分頁 30 筆、游標續讀與計數一致',async()=>{
    for(let n=0;n<31;n++){
      const body=run+'-pagination-'+n;const reply=(await c.req('/api/article-interactions',{kind:'post',id:post.id,action:'reply',body},201)).data.reply;
      report.fixtures.replies.push({kind:'post',id:reply.id,authorId:accounts[2].id,body});persist();
    }
    const first=(await g.req('/api/article-interactions?kind=post&id='+post.id)).data;
    assert.equal(first.replies.length,30);assert.equal(first.replyCount,32);assert.ok(first.nextCursor);
    const second=(await g.req('/api/article-interactions?kind=post&id='+post.id+'&cursor='+first.nextCursor)).data;
    assert.equal(second.replies.length,2);assert.equal(second.nextCursor,null);assert.ok(!second.replies.some(x=>first.replies.some(y=>x.id===y.id)));
    assert.equal((await g.req('/api/forum?id='+post.id)).data.post.replyCount,32);
  });
  await check('暱稱修改、跨 session 讀回與冒用會員編號不影響他人',async()=>{
    await a.req('/api/member-data',{action:'profile',name:run+'-暱稱',userId:accounts[1].id,role:'admin'});
    const user=(await a2.req('/api/member-session')).data.user;assert.equal(user.name,run+'-暱稱');assert.equal(user.role,'member');
    assert.equal((await b.req('/api/member-session')).data.user.name,originals[1].name);
    for(const name of ['', '字'.repeat(41)])await a.req('/api/member-data',{action:'profile',name},400);
  });
  await check('非法編號、游標、分頁與不存在內容的回應',async()=>{
    for(const path of ['/api/forum?id=invalid','/api/forum?id=9223372036854775808','/api/forum?cursor=invalid','/api/map-posts?cursor=invalid','/api/expert-columns?offset=-1','/api/expert-columns?offset=1.5','/api/article-interactions?kind=invalid&id=3','/api/article-interactions?kind=post&id='+post.id+'&cursor=invalid'])await g.req(path,undefined,400);
    for(const path of ['/api/forum?id=9223372036854775807','/api/expert-columns?id='+randomUUID(),'/api/article-interactions?kind=editorial&id=qa-does-not-exist'])await g.req(path,undefined,404);
  });
  await check('JSON 格式、請求大小、Content-Type 與 HTTP 方法防護',async()=>{
    const raw=async(body,status,headers={'Content-Type':'application/json'},method='POST')=>{const response=await fetch(base+'/api/member-data',{method,headers:{Origin:base,...headers},...(method==='POST'?{body}:{}),signal:AbortSignal.timeout(30000)});await response.text();assert.equal(response.status,status);};
    await raw('{',400);await raw('[]',400);await raw('null',400);await raw('{}',415,{'Content-Type':'text/plain'});await raw(JSON.stringify({value:'x'.repeat(65000)}),413);await raw(undefined,405,{},'PUT');
  });
  await check('公開頁與編輯精選可讀；不存在文章顯示 404 並禁止索引',async()=>{
    for(const path of ['/','/discussions','/discussions/write','/columns','/columns/write','/columns/balcony-field-notes','/columns/photograph-your-plant','/columns/ask-a-growing-question'])await g.req(path);
    // Next.js streaming responses retain HTTP 200; notFound injects noindex.
    for(const path of ['/discussions/9223372036854775807','/columns/community/'+randomUUID(),'/columns/qa-does-not-exist']){
      const {data}=await g.req(path,undefined,[200,404]);assert.match(data,/404/);assert.match(data,/<meta name="robots" content="noindex"/);
    }
  });
} catch(error) {report.fatal=String(error.message).slice(0,400);console.error('STOP '+report.fatal);}
finally {
  for(let i=0;i<originals.length;i++){
    try {
      for(const kind of ['discussion','column']){
        const original=originals[i].drafts[kind];
        await members[i].req('/api/member-data',original?{action:'saveDraft',kind,payload:original.payload}:{action:'deleteDraft',kind});
        assert.deepEqual((await members[i].req('/api/member-data?kind='+kind)).data.draft?.payload??null,original?.payload??null);
      }
      await members[i].req('/api/member-data',{action:'profile',name:originals[i].name});
      report.restoration.push({member:i+1,status:'PASS'});
    } catch {report.restoration.push({member:i+1,status:'FAIL'});}
  }
  for(const [index,req] of [a,b,c,a2].entries())await check('測試 session '+(index+1)+' 登出、舊 cookie 失效且無法寫入',async()=>{
    const old=req.cookie();await req.req('/api/auth/sign-out',{});
    const response=await fetch(base+'/api/member-session',{headers:{Cookie:old},signal:AbortSignal.timeout(30000)});assert.equal((await response.json()).user,null);
    await req.req('/api/member-data',{action:'saveDraft',kind:'discussion',payload:draft(0,'discussion')},401);
  });
  report.finishedAt=new Date().toISOString();
  report.summary={passed:report.checks.filter(v=>v.status==='PASS').length,failed:report.checks.filter(v=>v.status==='FAIL').length,restored:report.restoration.every(v=>v.status==='PASS')};
  persist();console.log(JSON.stringify({run,...report.summary,fixtures:report.fixtures}));
  if(report.fatal||report.summary.failed||!report.summary.restored)process.exitCode=1;
}
