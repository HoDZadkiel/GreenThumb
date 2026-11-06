import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database;
export const sessionAge = 60 * 60 * 24 * 7;

export function getTrialDatabase() {
  if (process.env.GREENTHUMB_TRIAL_AUTH !== "1") throw new Error("本機試用未啟用");
  if (database) return database;

  const directory = join(process.cwd(), ".local");
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "forum.sqlite"));
  db.exec(`
    pragma journal_mode = wal;
    pragma busy_timeout = 5000;
    create table if not exists users (
      id text primary key, email text not null unique, name text not null,
      password text not null, role text not null check (role in ('member', 'admin'))
    );
    create table if not exists sessions (
      token text primary key, user_id text not null references users(id) on delete cascade,
      expires_at integer not null
    );
    create table if not exists posts (
      id text primary key, author_id text not null references users(id),
      title text not null, body text not null, category text not null, images text not null
    );
  `);
  db.exec("begin immediate");
  try {
    const columns = db.prepare("pragma table_info(posts)").all();
    if (!columns.some((column) => column.name === "font")) {
      db.exec("alter table posts add column font text check (font in ('sans', 'serif'))");
    }
    if (!columns.some((column) => column.name === "font_size")) {
      db.exec("alter table posts add column font_size integer not null default 16 check (font_size in (14, 16, 18))");
    }
    db.exec("commit");
  } catch (error) {
    db.close();
    throw error;
  }
  database = db;
  return db;
}

export function createTrialUser(email, name, password, role = "member") {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const id = randomUUID();
  getTrialDatabase().prepare("insert into users values (?, ?, ?, ?, ?)").run(id, email, name, salt + ":" + hash, role);
  return { id, name, role };
}

export function findTrialUser(email, password) {
  const user = getTrialDatabase().prepare("select * from users where email = ?").get(email);
  if (!user) return null;
  const [salt, hash] = user.password.split(":");
  if (!timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 64))) return null;
  return { id: user.id, name: user.name, role: user.role };
}

function digest(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createTrialSession(userId) {
  const token = randomBytes(32).toString("hex");
  getTrialDatabase().prepare("insert into sessions values (?, ?, ?)").run(digest(token), userId, Date.now() + sessionAge * 1000);
  return token;
}

export function getTrialSession(token) {
  if (!token) return null;
  return getTrialDatabase().prepare(`
    select users.id, users.name, users.role from sessions join users on users.id = sessions.user_id
    where sessions.token = ? and sessions.expires_at > ?
  `).get(digest(token), Date.now()) ?? null;
}

export function revokeTrialSession(token) {
  if (token) getTrialDatabase().prepare("delete from sessions where token = ?").run(digest(token));
}
