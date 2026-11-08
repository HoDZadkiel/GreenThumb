import { randomUUID } from "node:crypto";
import regions from "./taiwan-regions.json" with { type: "json" };

export class ColumnError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ensureExpertColumns(db) {
  db.exec(`
    create table if not exists expert_columns (
      id text primary key,
      author_id text not null references users(id),
      title text not null check (length(title) between 1 and 100),
      excerpt text not null check (length(excerpt) between 1 and 200),
      body text not null check (length(body) between 1 and 5000),
      region_code text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists expert_columns_region on expert_columns(region_code);
    create index if not exists expert_columns_author on expert_columns(author_id);
  `);
}

const summary = `select c.id, c.author_id as authorId, c.title, c.excerpt,
  c.region_code as regionCode, c.created_at as createdAt, c.updated_at as updatedAt,
  u.name as author from expert_columns c join users u on u.id = c.author_id`;

export function listExpertColumns(db) {
  ensureExpertColumns(db);
  return db.prepare(summary + " order by c.created_at desc, c.rowid desc").all();
}

export function getExpertColumn(db, id) {
  ensureExpertColumns(db);
  const entry = db.prepare(summary + " where c.id = ?").get(id);
  if (!entry) return null;
  return { ...entry, body: db.prepare("select body from expert_columns where id = ?").get(id).body };
}

export function saveExpertColumn(db, user, input) {
  if (!user) throw new ColumnError("請先登入，再發表達人專欄。", 401);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const region = regions.find((item) => item.code === input.regionCode);
  if (!title || title.length > 100 || !excerpt || excerpt.length > 200 || !body || body.length > 5000) {
    throw new ColumnError("請填寫標題、簡介與內文，並確認沒有超過字數上限。");
  }
  if (!region) throw new ColumnError("請選擇有效的縣市及鄉鎮市區。");
  ensureExpertColumns(db);
  const now = new Date().toISOString();
  let id;
  if (input.id !== undefined) {
    if (typeof input.id !== "string") throw new ColumnError("專欄編號不正確。");
    id = input.id;
    const result = db.prepare(`update expert_columns set title = ?, excerpt = ?, body = ?,
      region_code = ?, updated_at = ? where id = ? and (author_id = ? or ? = 'admin')`)
      .run(title, excerpt, body, region.code, now, id, user.id, user.role);
    if (!result.changes) throw new ColumnError("找不到專欄，或你沒有編輯權限。", 403);
  } else {
    id = randomUUID();
    db.prepare(`insert into expert_columns (id, author_id, title, excerpt, body, region_code, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, user.id, title, excerpt, body, region.code, now, now);
  }
  return getExpertColumn(db, id);
}
