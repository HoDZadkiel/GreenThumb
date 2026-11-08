import test from "node:test";
import assert from "node:assert/strict";
import { validateAuth, validatePost, validateColumn, validateDraft, safeNext, validPostId } from "../src/lib/forum-input.mjs";
test("registration preserves passwords and validates profile input", () => {
  const result = validateAuth({ email: " USER@example.test ", password: " twelve chars ", name: " 園丁 " }, true);
  assert.equal(result.email, "user@example.test"); assert.equal(result.password, " twelve chars ");
  assert.throws(() => validateAuth({ email: "bad", password: "password", name: "a" }, true));
  assert.throws(() => validateAuth({ email: "a@b.test", password: "short", name: "a" }, true));
});
test("posts reject invalid images, sizes, identifiers and oversized content", () => {
  const input = { title: "標題", body: "內容", category: "觀葉植物", images: [], font: "serif", fontSize: 18 };
  assert.equal(validatePost(input).board.slug, "foliage");
  for (const invalid of [{ fontSize: 15 }, { images: ["https://i.ibb.co@evil.test/a"] }, { images: Array(6).fill("https://i.ibb.co/a") }, { body: "字".repeat(5001) }, { id: "1 or 1=1" }]) assert.throws(() => validatePost({ ...input, ...invalid }));
  assert.equal(validPostId("9223372036854775808"), false);
});
test("columns reject invented regions and callback redirects stay local", () => {
  assert.throws(() => validateColumn({ title: "標題", excerpt: "簡介", body: "內容", regionCode: "fake" }));
  for (const url of ["//evil.test", "https://evil.test", "/\\evil.test", "/\n/evil.test", "/\t/evil.test"]) assert.equal(safeNext(url), "/");
  assert.equal(safeNext("/columns?from=email"), "/columns?from=email");
});
test('cloud drafts accept unfinished content, preserve formatting, and reject forged data',()=>{
  const payload={title:'',body:'未完成',category:'觀葉植物',images:[],font:'serif',fontSize:18};
  assert.equal(validateDraft('discussion',payload).font,'serif');
  assert.throws(()=>validateDraft('discussion',{...payload,images:['https://evil.test/a']}));
  assert.equal(validateDraft('column',{title:'',body:'',county:'臺北市',regionCode:''}).county,'臺北市');
  assert.throws(()=>validateDraft('column',{regionCode:'63000030',county:'臺南市'}));
  assert.throws(()=>validateDraft('column',{body:'字'.repeat(5001)}));
});
