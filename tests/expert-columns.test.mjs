import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import regions from "../src/lib/taiwan-regions.json" with { type: "json" };
import { ColumnError, getExpertColumn, listExpertColumns, saveExpertColumn } from "../src/lib/expert-columns-store.mjs";

const owner = { id: "owner", name: "在地作者", role: "member" };
const other = { id: "other", name: "另一位作者", role: "member" };
const admin = { id: "admin", name: "管理員", role: "admin" };
const draft = { title: "陽台筆記", excerpt: "分享在地種植觀察", body: "## 我的種植環境\n朝東窗邊。", regionCode: "63000030" };
function database(t) {
  const db = new DatabaseSync(":memory:");
  db.exec("pragma foreign_keys = on; create table users (id text primary key, name text not null)");
  const insert = db.prepare("insert into users values (?, ?)");
  for (const user of [owner, other, admin]) insert.run(user.id, user.name);
  t.after(() => db.close());
  return db;
}

test("region data covers 22 counties/cities and 368 unique districts, including offshore islands", () => {
  assert.equal(regions.length, 368);
  assert.equal(new Set(regions.map((region) => region.code)).size, 368);
  assert.equal(new Set(regions.map((region) => region.county)).size, 22);
  for (const county of ["澎湖縣", "金門縣", "連江縣"]) assert.ok(regions.some((region) => region.county === county));
  assert.ok(regions.every((region) => Number.isFinite(region.lat) && Number.isFinite(region.lng) && region.lat > 21 && region.lat < 27 && region.lng > 117 && region.lng < 123));
});
test("visitor cannot create a column", (t) => {
  const db = database(t);
  assert.throws(() => saveExpertColumn(db, null, draft), (error) => error instanceof ColumnError && error.status === 401);
  assert.deepEqual(listExpertColumns(db), []);
});
test("published column persists author and region while list omits the full body", (t) => {
  const db = database(t);
  const result = saveExpertColumn(db, owner, draft);
  assert.equal(result.regionCode, "63000030");
  assert.equal(result.authorId, owner.id);
  assert.equal(result.author, owner.name);
  assert.equal(getExpertColumn(db, result.id).body, draft.body);
  assert.equal(listExpertColumns(db)[0].body, undefined);
});
test("rejects missing or forged location codes", (t) => {
  const db = database(t);
  for (const regionCode of ["", null, "00000000", "<script>", "臺北市大安區"]) {
    assert.throws(() => saveExpertColumn(db, owner, { ...draft, regionCode }), ColumnError);
  }
  assert.equal(listExpertColumns(db).length, 0);
});
test("rejects blank content and values beyond each field limit", (t) => {
  const db = database(t);
  for (const [field, size] of [["title", 100], ["excerpt", 200], ["body", 5000]]) {
    assert.throws(() => saveExpertColumn(db, owner, { ...draft, [field]: "  \n " }), ColumnError);
    assert.throws(() => saveExpertColumn(db, owner, { ...draft, [field]: "字".repeat(size + 1) }), ColumnError);
  }
});
test("author can move their existing column without creating another pin", (t) => {
  const db = database(t);
  const entry = saveExpertColumn(db, owner, draft);
  const updated = saveExpertColumn(db, owner, { ...draft, id: entry.id, regionCode: "10016010", title: "海風裡的植物" });
  assert.equal(updated.id, entry.id);
  assert.equal(updated.regionCode, "10016010");
  assert.equal(updated.createdAt, entry.createdAt);
  assert.equal(listExpertColumns(db).length, 1);
});
test("other members cannot edit a column or its location", (t) => {
  const db = database(t);
  const entry = saveExpertColumn(db, owner, draft);
  assert.throws(() => saveExpertColumn(db, other, { ...draft, id: entry.id, regionCode: "10016010" }), (error) => error.status === 403);
  assert.equal(getExpertColumn(db, entry.id).regionCode, draft.regionCode);
});
test("server session controls author identity, not submitted author fields", (t) => {
  const db = database(t);
  const entry = saveExpertColumn(db, owner, { ...draft, authorId: other.id, author: other.name, lat: 0, lng: 0 });
  assert.equal(entry.authorId, owner.id);
  assert.equal(entry.lat, undefined);
  assert.equal(entry.lng, undefined);
});
test("administrator can update a column while preserving its original author", (t) => {
  const db = database(t);
  const entry = saveExpertColumn(db, owner, draft);
  const result = saveExpertColumn(db, admin, { ...draft, id: entry.id, regionCode: "10016010" });
  assert.equal(result.authorId, owner.id);
  assert.equal(result.regionCode, "10016010");
});
test("multiple columns in the same district remain distinct pins", (t) => {
  const db = database(t);
  const first = saveExpertColumn(db, owner, draft);
  const second = saveExpertColumn(db, other, draft);
  assert.notEqual(first.id, second.id);
  assert.equal(listExpertColumns(db).length, 2);
});
test("unknown update id does not silently create a column", (t) => {
  const db = database(t);
  assert.throws(() => saveExpertColumn(db, owner, { ...draft, id: "missing" }), (error) => error.status === 403);
  assert.equal(getExpertColumn(db, "missing"), null);
});
