import type { SupabaseClient } from "@supabase/supabase-js";
import type { ForumUser } from "@/components/community/community-session";
import type { ArticleInteractions, ArticleKind } from "@/lib/article-interactions";
import { ForumError, validColumnId, validPostId } from "@/lib/forum-input.mjs";
import { databaseError } from "./forum";

export function articleTarget(kind: unknown, id: unknown): { kind: ArticleKind; id: string } {
  if (typeof id !== "string" || !(
    (kind === "post" && validPostId(id)) ||
    (kind === "column" && validColumnId(id)) ||
    (kind === "editorial" && /^[a-z0-9-]{1,100}$/.test(id))
  )) throw new ForumError("文章編號不正確。");
  return { kind: kind as ArticleKind, id };
}

type Target = ReturnType<typeof articleTarget>;
function tables(target: Target) {
  return target.kind === "post"
    ? { replies: "replies", likes: "post_likes", key: "post_id" }
    : { replies: "column_replies", likes: "column_likes", key: target.kind === "column" ? "column_id" : "editorial_slug" };
}

async function articleStatus(client: SupabaseClient, target: Target) {
  const table = target.kind === "post" ? "posts" : target.kind === "column" ? "expert_columns" : "editorial_articles";
  let query = client.from(table).select(target.kind === "post" ? "id,is_locked" : target.kind === "column" ? "id" : "slug").eq(target.kind === "editorial" ? "slug" : "id", target.id);
  if (target.kind === "post") query = query.is("deleted_at", null);
  if (target.kind === "editorial") query = query.eq("published", true);
  const { data, error } = await query.maybeSingle<{ is_locked?: boolean }>();
  if (error) throw databaseError(error);
  if (!data) throw new ForumError("找不到文章。", 404);
  return { canReply: !data.is_locked };
}

type ReplyRow = { id: string | number; author_id: string; body: string; created_at: string; profile: { display_name: string } | null };
export async function getInteractions(client: SupabaseClient, user: ForumUser | null, target: Target, cursor: string | null = null): Promise<ArticleInteractions> {
  if (cursor !== null && !validPostId(cursor)) throw new ForumError("回應分頁編號不正確。");
  const { canReply } = await articleStatus(client, target);
  const table = tables(target);
  const profileKey = table.replies === "replies" ? "replies_author_id_fkey" : "column_replies_author_id_fkey";
  let replies = client.from(table.replies).select(`id,author_id,body,created_at,profile:profiles!${profileKey}(display_name)`).eq(table.key, target.id).order("id").limit(31);
  let replyCountQuery = client.from(table.replies).select("id", { count: "exact", head: true }).eq(table.key, target.id);
  if (target.kind === "post") {
    replies = replies.is("deleted_at", null);
    replyCountQuery = replyCountQuery.is("deleted_at", null);
  }
  if (cursor) replies = replies.gt("id", cursor);
  const [replyResult, totalReplies, totalLikes, myLike] = await Promise.all([
    replies.returns<ReplyRow[]>(),
    replyCountQuery,
    client.from(table.likes).select("user_id", { count: "exact", head: true }).eq(table.key, target.id),
    user ? client.from(table.likes).select("user_id").eq(table.key, target.id).eq("user_id", user.id).limit(1) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [replyResult, totalReplies, totalLikes, myLike]) if (result.error) throw databaseError(result.error);
  const rows = replyResult.data!.slice(0, 30);
  return {
    liked: Boolean(myLike.data?.length), likeCount: totalLikes.count ?? 0, replyCount: totalReplies.count ?? 0, canReply,
    replies: rows.map(row => ({ id: String(row.id), authorId: row.author_id, author: row.profile?.display_name ?? "會員", body: row.body, createdAt: row.created_at })),
    nextCursor: replyResult.data!.length > 30 ? String(rows.at(-1)!.id) : null,
  };
}

export async function interact(client: SupabaseClient, user: ForumUser | null, target: Target, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入，再按讚或回應文章。", 401);
  const { canReply } = await articleStatus(client, target);
  const table = tables(target);
  if (input.action === "reply") {
    if (!canReply) throw new ForumError("這篇文章已鎖定，暫時無法新增回應。", 403);
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!body || body.length > 2000) throw new ForumError("請輸入 1–2000 字的回應。");
    const { data, error } = await client.from(table.replies).insert({ [table.key]: target.id, author_id: user.id, body }).select("id,created_at").single();
    if (error) throw databaseError(error);
    return { reply: { id: String(data.id), authorId: user.id, author: user.name, body, createdAt: data.created_at } };
  }
  if (input.action === "like") {
    if (typeof input.liked !== "boolean") throw new ForumError("按讚狀態不正確。");
    const result = input.liked
      ? await client.from(table.likes).upsert({ [table.key]: target.id, user_id: user.id }, { onConflict: `${table.key},user_id`, ignoreDuplicates: true })
      : await client.from(table.likes).delete().eq(table.key, target.id).eq("user_id", user.id);
    if (result.error) throw databaseError(result.error);
    const { count, error } = await client.from(table.likes).select("user_id", { count: "exact", head: true }).eq(table.key, target.id);
    if (error) throw databaseError(error);
    return { liked: input.liked, likeCount: count ?? 0 };
  }
  throw new ForumError("不支援的操作。");
}
