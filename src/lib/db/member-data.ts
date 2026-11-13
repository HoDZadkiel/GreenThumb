import { ForumError, validateDraft, validPostId } from "@/lib/forum-input.mjs";
import type { Database } from "./server";

export async function bookmarkIds(db: Database) {
  return (await db.query("select post_id from public.post_bookmarks order by post_id")).rows.map(row => String(row.post_id));
}
export async function readDraft(db: Database, userId: string, kind: string) {
  if (!["discussion", "column"].includes(kind)) throw new ForumError("草稿類型不正確。");
  return (await db.query("select payload,updated_at from public.member_drafts where user_id=$1 and kind=$2", [userId, kind])).rows[0] ?? null;
}
export async function writeMemberData(db: Database, userId: string, input: Record<string, unknown>) {
  if (input.action === "profile") {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 40) throw new ForumError("請輸入 1–40 字的暱稱。");
    await db.query("update public.profiles set display_name=$1 where id=$2", [name, userId]);
    return { ok: true };
  }
  if (input.action === "bookmark") {
    if (!validPostId(input.postId) || typeof input.saved !== "boolean") throw new ForumError("收藏資料不正確。");
    await db.query(input.saved
      ? "insert into public.post_bookmarks (user_id,post_id) values ($1,$2) on conflict do nothing"
      : "delete from public.post_bookmarks where user_id=$1 and post_id=$2", [userId, input.postId]);
    return { saved: input.saved };
  }
  if (!["discussion", "column"].includes(String(input.kind))) throw new ForumError("草稿類型不正確。");
  if (input.action === "saveDraft") {
    const payload = validateDraft(input.kind, input.payload);
    await db.query("select public.save_member_draft($1,$2::jsonb)", [input.kind, JSON.stringify(payload)]);
    return { ok: true };
  }
  if (input.action === "deleteDraft") {
    await db.query("delete from public.member_drafts where user_id=$1 and kind=$2", [userId, input.kind]);
    return { ok: true };
  }
  throw new ForumError("不支援的操作。");
}
