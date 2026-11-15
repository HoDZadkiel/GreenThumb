import test from 'node:test';
import assert from 'node:assert/strict';
import {connectDatabase,withMemberDatabase} from '../src/lib/db/pool.mjs';
const capacity=()=>Object.assign(new Error('max clients reached in session mode'),{code:'XX000'});

test('temporary session capacity waits for a free connection before starting work',async()=>{
 let attempts=0;const client={};
 assert.equal(await connectDatabase({connect:async()=>{if(++attempts<3)throw capacity();return client;}}),client);
 assert.equal(attempts,3);
});

test('other connection failures are not retried',async()=>{
 let attempts=0;
 await assert.rejects(connectDatabase({connect:async()=>{attempts++;throw Object.assign(new Error('denied'),{code:'42501'});}}));
 assert.equal(attempts,1);
});

test('failure after a transaction starts rolls back once without replaying work',async()=>{
 const queries=[];let attempts=0,releases=0,workCalls=0;
 const pool={connect:async()=>{attempts++;return {query:async text=>queries.push(text),release:()=>releases++};}};
 await assert.rejects(withMemberDatabase(pool,null,async()=>{workCalls++;throw capacity();}));
 assert.equal(attempts,1);assert.equal(workCalls,1);assert.equal(releases,1);assert.equal(queries.at(-1),'rollback');
});
