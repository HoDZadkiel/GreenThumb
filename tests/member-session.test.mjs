import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemberSessionStore, memberSessionEvent, notifyMemberSessionChange } from '../src/lib/member-session-store.mjs';
import { assertSessionOwner } from '../src/lib/forum-input.mjs';
import { memberRequest } from '../src/lib/member-client.ts';
import { savePost, saveColumn } from '../src/lib/db/forum.ts';
import { writeMemberData } from '../src/lib/db/member-data.ts';
import { interact } from '../src/lib/db/article-interactions.ts';

const a={id:'11111111-1111-4111-8111-111111111111',name:'會員 A',role:'member'};
const b={...a,id:'22222222-2222-4222-8222-222222222222',name:'會員 B'};
const auth={google:false,email:false,password:true};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class DetailEvent extends Event { constructor(type,{detail}={}){super(type);this.detail=detail;} }
function tabs(count=2) {
  const windows=Array.from({length:count},()=>{
    const win=new EventTarget();win.CustomEvent=DetailEvent;
    const doc=new EventTarget();doc.visibilityState='visible';win.document=doc;
    return win;
  });
  for(const win of windows)win.localStorage={setItem(key,newValue){for(const other of windows)if(other!==win){const event=new Event('storage');Object.assign(event,{key,newValue});other.dispatchEvent(event);}}};
  return windows;
}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

test('cross-tab logout clears member-owned editors before a new member is loaded',async t=>{
  let serverUser=a;
  const [windowA,windowB]=tabs();
  const storeA=createMemberSessionStore(async()=>({user:serverUser,auth}));
  const storeB=createMemberSessionStore(async()=>({user:serverUser,auth}));
  t.after(storeA.connect(windowA,windowA.document));t.after(storeB.connect(windowB,windowB.document));await tick();
  assert.equal(storeA.getSnapshot().user.id,a.id);
  const initialVersion=storeA.getSnapshot().editorVersion;
  serverUser=null;storeB.changeUser(null);
  // The React boundary is keyed by this version; all private inputs remount.
  assert.equal(storeA.getSnapshot().user,null);
  assert.equal(storeA.getSnapshot().editorVersion,initialVersion+1);
  serverUser=b;storeB.changeUser(b);await tick();
  assert.equal(storeA.getSnapshot().user.id,b.id);assert.equal(storeA.isCurrentUser(a.id),false);
  assert.equal(storeA.getSnapshot().editorVersion,initialVersion+1);
});

test('same-tab logout resets private editor state; first guest sign-in preserves unsaved guest input',async()=>{
  const store=createMemberSessionStore();
  const guestVersion=store.getSnapshot().editorVersion;
  store.changeUser(a);assert.equal(store.getSnapshot().editorVersion,guestVersion);
  store.changeUser({...a,name:'新暱稱'});assert.equal(store.getSnapshot().editorVersion,guestVersion);
  store.changeUser(null);assert.equal(store.getSnapshot().user,null);assert.equal(store.getSnapshot().editorVersion,guestVersion+1);
  store.changeUser(b);assert.equal(store.getSnapshot().editorVersion,guestVersion+1);
});

test('late requests cannot restore a logged-out member or replace a newer session',async t=>{
  const reads=[];
  const store=createMemberSessionStore(()=>{const read=deferred();reads.push(read);return read.promise;});
  const [win]=tabs(1);t.after(store.connect(win,win.document));
  store.changeUser(a);
  const staleRefresh=store.refresh();
  store.changeUser(null);store.changeUser(b);
  reads[1].resolve({user:a,auth});await staleRefresh;
  reads[0].resolve({user:a,auth});await tick();
  assert.equal(store.getSnapshot().user.id,b.id);
  assert.equal(store.getSnapshot().editorVersion,1);
});

test('focus, visible pages and back-forward navigation revalidate a missed account switch',async t=>{
  let serverUser=a;
  const store=createMemberSessionStore(async()=>({user:serverUser,auth}));
  const [win]=tabs(1);win.localStorage.setItem=()=>{throw new Error('storage unavailable');};
  t.after(store.connect(win,win.document));await tick();
  serverUser=b;win.dispatchEvent(new Event('focus'));await tick();
  assert.equal(store.getSnapshot().user.id,b.id);assert.equal(store.getSnapshot().editorVersion,1);
  serverUser=null;win.document.dispatchEvent(new Event('visibilitychange'));await tick();
  assert.equal(store.getSnapshot().user,null);assert.equal(store.getSnapshot().editorVersion,2);
  serverUser=a;win.dispatchEvent(new Event('pageshow'));await tick();assert.equal(store.getSnapshot().user.id,a.id);
});

test('same-window notifications synchronize independently mounted page providers',async t=>{
  let serverUser=a;
  const [win]=tabs(1);
  const first=createMemberSessionStore(async()=>({user:serverUser,auth}));
  const second=createMemberSessionStore(async()=>({user:serverUser,auth}));
  t.after(first.connect(win,win.document));t.after(second.connect(win,win.document));await tick();
  serverUser=null;first.changeUser(null);assert.equal(second.getSnapshot().user,null);
  serverUser=b;first.changeUser(b);await tick();assert.equal(second.getSnapshot().user.id,b.id);
});

test('signals never supply trusted identity and disconnected providers ignore old events',async()=>{
  const store=createMemberSessionStore(async()=>({user:a,auth}));const [win]=tabs(1);
  const disconnect=store.connect(win,win.document);await tick();
  win.dispatchEvent(new DetailEvent(memberSessionEvent,{detail:{user:b,source:'untrusted'}}));await tick();
  assert.equal(store.getSnapshot().user.id,a.id);
  disconnect();notifyMemberSessionChange(true,win);assert.equal(store.getSnapshot().user.id,a.id);
});

test('all member mutation paths reject a stale or missing owner before any database access',async()=>{
  const database={userId:b.id,query(){assert.fail('a stale request must not reach the database');}};
  for(const expectedUserId of [undefined,null,a.id,{},['invalid']]){
    const input={expectedUserId};const rejected=error=>error.status===409;
    assert.throws(()=>assertSessionOwner(b.id,input),rejected);
    await assert.rejects(writeMemberData(database,b.id,{...input,action:'saveDraft',kind:'discussion'}),rejected);
    await assert.rejects(writeMemberData(database,b.id,{...input,action:'saveDraft',kind:'column'}),rejected);
    await assert.rejects(writeMemberData(database,b.id,{...input,action:'profile'}),rejected);
    await assert.rejects(writeMemberData(database,b.id,{...input,action:'bookmark'}),rejected);
    await assert.rejects(writeMemberData(database,b.id,{...input,action:'deleteDraft'}),rejected);
    await assert.rejects(savePost(database,b,input),rejected);
    await assert.rejects(saveColumn(database,b,input),rejected);
    for(const kind of ['post','column','editorial'])for(const action of ['reply','like'])await assert.rejects(interact(database,b,{kind,id:'1'},{...input,action}),rejected);
  }
  assert.doesNotThrow(()=>assertSessionOwner(b.id,{expectedUserId:b.id}));
  await assert.rejects(savePost(database,null,{}),error=>error.status===401);
});

test('write client pins the captured owner and rejects mismatched sessions without retrying',async t=>{
  const requests=[];
  t.mock.method(globalThis,'fetch',async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return Response.json({error:'登入身分已變更，請重新整理後再試。'},{status:409});});
  await assert.rejects(memberRequest('/api/member-data',{action:'saveDraft',expectedUserId:b.id},a.id),/登入身分已變更/);
  assert.equal(requests.length,1);assert.equal(requests[0].body.expectedUserId,a.id);
});

test('a server identity mismatch immediately invalidates private UI and fetches the actual member',async t=>{
  const [win]=tabs(1);let serverUser=a;
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:win});
  t.after(()=>{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;});
  const store=createMemberSessionStore(async()=>({user:serverUser,auth}));
  t.after(store.connect(win,win.document));await tick();serverUser=b;
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:'登入身分已變更，請重新整理後再試。'},{status:409}));
  const snapshots=[];const unsubscribe=store.subscribe(()=>snapshots.push(store.getSnapshot()));t.after(unsubscribe);
  await assert.rejects(memberRequest('/api/member-data',{action:'saveDraft'},a.id),/登入身分已變更/);
  assert.equal(snapshots[0].user,null);assert.equal(snapshots[0].editorVersion,1);
  await tick();assert.equal(store.getSnapshot().user.id,b.id);
});
