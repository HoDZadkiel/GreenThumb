import type { ForumUser } from "@/components/community/community-session";
import type { ArticleInteractions, ArticleKind } from "@/lib/article-interactions";
import { ForumError, validColumnId, validPostId } from "@/lib/forum-input.mjs";
import type { Database } from "./server";

export function articleTarget(kind: unknown, id: unknown): { kind: ArticleKind; id: string } {
  if (typeof id !== "string" || !((kind === "post" && validPostId(id)) || (kind === "column" && validColumnId(id)) ||
      (kind === "editorial" && /^[a-z0-9-]{1,100}$/.test(id)))) throw new ForumError("文章編號不正確。");
  return { kind: kind as ArticleKind, id };
}
type Target = ReturnType<typeof articleTarget>;
function tables(target: Target) {
  return target.kind === "post" ? { replies: "replies", likes: "post_likes", key: "post_id" }
    : { replies: "column_replies", likes: "column_likes", key: target.kind === "column" ? "column_id" : "editorial_slug" };
}
async function articleStatus(db: Database, target: Target) {
  const query = target.kind === "post" ? "select not is_locked as can_reply from public.posts where id=$1 and deleted_at is null"
    : target.kind === "column" ? "select true as can_reply from public.expert_columns where id=$1"
      : "select true as can_reply from public.editorial_articles where slug=$1 and published";
  const { rows } = await db.query(query, [target.id]);
  if (!rows[0]) throw new ForumError("找不到文章。", 404);
  return rows[0].can_reply as boolean;
}
export async function getInteractions(db: Database, user: ForumUser | null, target: Target, cursor: string | null = null): Promise<ArticleInteractions> {
  if (cursor !== null && !validPostId(cursor)) throw new ForumError("回應分頁編號不正確。");
  const canReply = await articleStatus(db, target);
  const table = tables(target);
  // Identifiers come exclusively from this fixed mapping; user values are parameters.
  const visible = target.kind === "post" ? "and r.deleted_at is null" : "";
  const replies = await db.query(`select r.id,r.author_id,r.body,r.created_at,p.display_name from public.${table.replies} r
    join public.profiles p on p.id=r.author_id where r.${table.key}=$1 ${visible} and ($2::bigint is null or r.id>$2) order by r.id limit 31`, [target.id, cursor]);
  const counts = await db.query(`select (select count(*)::int from public.${table.replies} r where r.${table.key}=$1 ${visible}) as replies,
    count(*)::int as likes, coalesce(bool_or(user_id=$2::uuid),false) as liked from public.${table.likes} where ${table.key}=$1`, [target.id, user?.id ?? null]);
  return { canReply, liked: counts.rows[0].liked, likeCount: counts.rows[0].likes, replyCount: counts.rows[0].replies,
    replies: replies.rows.slice(0, 30).map(row => ({ id: String(row.id), authorId: row.author_id, author: row.display_name,
      body: row.body, createdAt: row.created_at.toISOString() })),
    nextCursor: replies.rows.length > 30 ? String(replies.rows[29].id) : null };
}
export async function interact(db: Database, user: ForumUser | null, target: Target, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入，再按讚或回應文章。", 401);
  const canReply = await articleStatus(db, target);
  const table = tables(target);
  if (input.action === "reply") {
    if (!canReply) throw new ForumError("這篇文章已鎖定，暫時無法新增回應。", 403);
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!body || body.length > 2000) throw new ForumError("請輸入 1–2000 字的回應。");
    const { rows } = await db.query(`insert into public.${table.replies} (${table.key},author_id,body) values ($1,$2,$3) returning id,created_at`, [target.id, user.id, body]);
    return { reply: { id: String(rows[0].id), authorId: user.id, author: user.name, body, createdAt: rows[0].created_at.toISOString() } };
  }
  if (input.action === "like") {
    if (typeof input.liked !== "boolean") throw new ForumError("按讚狀態不正確。");
    await db.query(input.liked ? `insert into public.${table.likes} (${table.key},user_id) values ($1,$2) on conflict do nothing`
      : `delete from public.${table.likes} where ${table.key}=$1 and user_id=$2`, [target.id, user.id]);
    const { rows } = await db.query(`select count(*)::int as n from public.${table.likes} where ${table.key}=$1`, [target.id]);
    return { liked: input.liked, likeCount: rows[0].n };
  }
  throw new ForumError("不支援的操作。");
}
