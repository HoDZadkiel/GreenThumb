import type { SupabaseClient } from "@supabase/supabase-js";
import type { ForumUser } from "@/components/community/community-session";
import type { ForumPost } from "@/lib/trial-forum-client";
import type { ArticlePin, ExpertColumn, ExpertColumnSummary } from "@/lib/expert-columns";
import { ForumError, validateColumn, validatePost, validColumnId, validPostId } from "@/lib/forum-input.mjs";

export function databaseError(error: { code?: string; message?: string }) {
  if (["PGRST205", "PGRST200", "42P01", "42703"].includes(error.code ?? "")) return new ForumError("Supabase 資料表尚未就緒，請先完成資料庫 migration。", 503);
  if (["42501", "PGRST301"].includes(error.code ?? "")) return new ForumError("你沒有執行此操作的權限。", 403);
  return new ForumError("暫時無法連線或儲存資料，請稍後再試。", 503);
}
export async function currentUser(client: SupabaseClient): Promise<ForumUser | null> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw new ForumError("登入狀態無法驗證，請重新登入或稍後再試。", 401);
  if (!user) return null;
  const { data, error: profileError } = await client.from("profiles").select("id,display_name,role").eq("id", user.id).maybeSingle();
  if (profileError) throw databaseError(profileError);
  if (!data) throw new ForumError("會員資料尚未建立，請先完成資料庫 migration。", 503);
  return { id: data.id, name: data.display_name, role: data.role };
}
type PostRow = {
  id: number | string; author_id: string; title: string; body: string; images: string[];
  font: "sans" | "serif" | null; font_size: 14 | 16 | 18;
  created_at: string; like_count: number; reply_count: number; region: string | null; region_code: string | null; post_type: string;
  board: { name: string } | null; profile: { display_name: string } | null;
};
const postSelect = "id,author_id,title,body,images,font,font_size,created_at,like_count,reply_count,region,region_code,post_type,board:boards!posts_board_id_fkey(name),profile:profiles!posts_author_id_fkey(display_name)";
const postResult = (row: PostRow): ForumPost => ({
  id: String(row.id), title: row.title, body: row.body, category: row.board?.name ?? "觀葉植物",
  images: row.images, font: row.font, fontSize: row.font_size, authorId: row.author_id, author: row.profile?.display_name ?? "會員",
  createdAt: row.created_at, likeCount: row.like_count, replyCount: row.reply_count, region: row.region, regionCode: row.region_code, postType: row.post_type,
});
export async function listPosts(client: SupabaseClient, cursor: string | null = null) {
  if (cursor && !validPostId(cursor)) throw new ForumError("文章分頁編號不正確。");
  let query = client.from("posts").select(postSelect).is("deleted_at", null).order("id", { ascending: false }).limit(51);
  if (cursor) query = query.lt("id", cursor);
  const { data, error } = await query.returns<PostRow[]>();
  if (error) throw databaseError(error);
  const rows = data.slice(0, 50);
  return { posts: rows.map(postResult), nextCursor: data.length > 50 ? String(rows.at(-1)!.id) : null };
}
export async function getPost(client: SupabaseClient, id: string) {
  if (!validPostId(id)) throw new ForumError("文章編號不正確。");
  const { data, error } = await client.from("posts").select(postSelect).eq("id", id).is("deleted_at", null).maybeSingle<PostRow>();
  if (error) throw databaseError(error);
  return data ? postResult(data) : null;
}
export async function savePost(client: SupabaseClient, user: ForumUser | null, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入再發文。", 401);
  const fields = validatePost(input);
  const { data: board, error: boardError } = await client.from("boards").select("id").eq("slug", fields.board.slug).maybeSingle();
  if (boardError) throw databaseError(boardError);
  if (!board) throw new ForumError("植物看板尚未建立，請完成資料庫 migration。", 503);
  const values = { title: fields.title, body: fields.body, board_id: board.id, images: fields.images, font: fields.font, font_size: fields.fontSize,
    ...(input.regionCode !== undefined ? { region_code: fields.regionCode } : {}) };
  const query = input.id !== undefined ? client.from("posts").update(values).eq("id", input.id) : client.from("posts").insert({ ...values, author_id: user.id });
  const { data, error } = await query.select(postSelect).maybeSingle<PostRow>();
  if (error) throw databaseError(error);
  if (!data) throw new ForumError("找不到文章，或你沒有編輯權限。", 403);
  return postResult(data);
}

export async function listMappedPosts(client: SupabaseClient, cursor: string | null = null) {
  if (cursor !== null && !validPostId(cursor)) throw new ForumError("地圖文章分頁編號不正確。");
  let query = client.from("posts").select("id,title,region_code,created_at,profile:profiles!posts_author_id_fkey(display_name)")
    .is("deleted_at", null).not("region_code", "is", null).order("id", { ascending: false }).limit(201);
  if (cursor) query = query.lt("id", cursor);
  const { data, error } = await query.returns<{ id: string | number; title: string; region_code: string; created_at: string; profile: { display_name: string } | null }[]>();
  if (error) throw databaseError(error);
  const rows = data.slice(0, 200);
  const pins: ArticlePin[] = rows.map(row => ({
    id: `post:${row.id}`, kind: "post", title: row.title, author: row.profile?.display_name ?? "會員",
    regionCode: row.region_code, createdAt: row.created_at, href: `/discussions/${row.id}`,
  }));
  return { pins, nextCursor: data.length > 200 ? String(rows.at(-1)!.id) : null };
}
type ColumnRow = {
  id: string; author_id: string; title: string; excerpt: string; body?: string; region_code: string;
  created_at: string; updated_at: string; profile: { display_name: string } | null;
};
const columnSelect = "id,author_id,title,excerpt,region_code,created_at,updated_at,profile:profiles!expert_columns_author_id_fkey(display_name)";
const columnResult = (row: ColumnRow): ExpertColumnSummary => ({
  id: row.id, authorId: row.author_id, author: row.profile?.display_name ?? "會員", title: row.title, excerpt: row.excerpt,
  regionCode: row.region_code, createdAt: row.created_at, updatedAt: row.updated_at,
});
export async function listColumns(client: SupabaseClient, offset = 0) {
  const { data, error } = await client.from("expert_columns").select(columnSelect).order("created_at", { ascending: false }).order("id").range(offset, offset + 199).returns<ColumnRow[]>();
  if (error) throw databaseError(error);
  return { columns: data.map(columnResult), nextOffset: data.length === 200 ? offset + 200 : null };
}
export async function getColumn(client: SupabaseClient, id: string): Promise<ExpertColumn | null> {
  if (!validColumnId(id)) return null;
  const { data, error } = await client.from("expert_columns").select(columnSelect + ",body").eq("id", id).maybeSingle<ColumnRow>();
  if (error) throw databaseError(error);
  return data ? { ...columnResult(data), body: data.body! } : null;
}
export async function saveColumn(client: SupabaseClient, user: ForumUser | null, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入，再發表達人專欄。", 401);
  const fields = validateColumn(input);
  const values = { title: fields.title, excerpt: fields.excerpt, body: fields.body, region_code: fields.regionCode };
  const query = input.id !== undefined ? client.from("expert_columns").update(values).eq("id", input.id) : client.from("expert_columns").insert({ ...values, author_id: user.id });
  const { data, error } = await query.select(columnSelect + ",body").maybeSingle<ColumnRow>();
  if (error) throw databaseError(error);
  if (!data) throw new ForumError("找不到專欄，或你沒有編輯權限。", 403);
  return { ...columnResult(data), body: data.body! };
}
