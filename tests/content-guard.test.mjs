import test from 'node:test';
import assert from 'node:assert/strict';
import {contentClientKey,contentReadPolicy,contentGuardResponse} from '../src/lib/content-guard.mjs';

test('content reads cover HTML, RSC and API aliases without blocking assets or sign-in',()=>{
  for(const path of ['/','/discussions','/columns','/api/forum','/api/trial-forum','/api/map-posts','/api/expert-columns'])assert.equal(contentReadPolicy('GET',new URL(path,'https://example.test')),'list');
  for(const path of ['/discussions/random-id?_rsc=1','/columns/community/uuid','/columns/balcony-field-notes','/api/forum?id=8','/api/trial-forum?id=8','/api/expert-columns?id=uuid','/api/article-interactions?kind=post&id=uuid'])assert.equal(contentReadPolicy('HEAD',new URL(path,'https://example.test')),'detail');
  for(const path of ['/discussions/write','/columns/write','/api/auth/sign-out','/_next/static/app.js','/favicon.ico'])assert.equal(contentReadPolicy('GET',new URL(path,'https://example.test')),null);
  assert.equal(contentReadPolicy('POST',new URL('/api/forum','https://example.test')),null);
});

test('Vercel-only client identity ignores spoofed forwarding, cookies and IPv6 spellings',()=>{
  const env={VERCEL:'1',BETTER_AUTH_SECRET:'test-only-secret'};
  const headers=new Headers({'x-vercel-forwarded-for':'192.0.2.1','x-forwarded-for':'198.51.100.1'});
  const key=contentClientKey(headers,env);
  headers.set('x-forwarded-for','198.51.100.2');headers.set('cookie','new-user');
  assert.equal(contentClientKey(headers,env),key);
  assert.ok(!key.includes('192.0.2.1'));
  headers.set('x-vercel-forwarded-for','192.0.2.2');assert.notEqual(contentClientKey(headers,env),key);
  const local={BETTER_AUTH_SECRET:'test-only-secret'};
  assert.equal(contentClientKey(headers,local),contentClientKey(new Headers(),local));
  headers.set('x-vercel-forwarded-for','2001:db8::1');const ipv6=contentClientKey(headers,env);
  headers.set('x-vercel-forwarded-for','2001:0db8:0000:0000:0000:0000:0000:0001');assert.equal(contentClientKey(headers,env),ipv6);
  assert.throws(()=>contentClientKey(headers,{}));
});

test('429 and unavailable storage responses instruct retries without leaking or caching errors',async()=>{
  const api=contentGuardResponse(true,429,34);
  assert.equal(api.status,429);assert.equal(api.headers.get('retry-after'),'34');assert.match(api.headers.get('cache-control'),/no-store/);
  assert.match((await api.json()).error,/過快/);
  const html=contentGuardResponse(false,503,30);
  assert.equal(html.status,503);assert.match(html.headers.get('content-type'),/text\/html/);assert.equal(html.headers.get('x-robots-tag'),'noindex');
  assert.match(await html.text(),/返回 GreenThumb/);
});
