import type { ForumUser } from "@/components/community/community-session";
import type { ForumPost } from "@/lib/trial-forum-client";
import type { ArticlePin, ExpertColumn, ExpertColumnSummary } from "@/lib/expert-columns";
import { ForumError, validateColumn, validatePost, validColumnId, validPostId } from "@/lib/forum-input.mjs";
import type { Database } from "./server";

export function databaseError(error: { code?: string }) {
  if (["42P01", "42703"].includes(error.code ?? "")) return new ForumError("資料庫尚未就緒，請先完成 migration。", 503);
  if (error.code === "42501") return new ForumError("你沒有執行此操作的權限。", 403);
  return new ForumError("暫時無法連線或儲存資料，請稍後再試。", 503);
}
export async function currentUser(db: Database): Promise<ForumUser | null> {
  if (!db.userId) return null;
  const { rows } = await db.query("select id,display_name,role from public.profiles where id=$1", [db.userId]);
  if (!rows[0]) throw new ForumError("會員資料尚未建立。", 503);
  return { id: rows[0].id, name: rows[0].display_name, role: rows[0].role };
}

const postSelect = `select p.*, b.name as board_name, u.display_name as author_name
  from public.posts p join public.boards b on b.id=p.board_id join public.profiles u on u.id=p.author_id`;
type PostRow = { id: string; author_id: string; title: string; body: string; board_name: string; author_name: string; images: string[]; font: "sans" | "serif" | null; font_size: 14 | 16 | 18; created_at: Date; like_count: number; reply_count: number; region: string | null; region_code: string | null; post_type: string };
const postResult = (row: PostRow): ForumPost => ({ id: String(row.id), authorId: row.author_id, author: row.author_name, title: row.title, body: row.body,
  category: row.board_name, images: row.images, font: row.font, fontSize: row.font_size, createdAt: row.created_at.toISOString(),
  likeCount: row.like_count, replyCount: row.reply_count, region: row.region, regionCode: row.region_code, postType: row.post_type });

export async function listPosts(db: Database, cursor: string | null = null) {
  if (cursor && !validPostId(cursor)) throw new ForumError("文章分頁編號不正確。");
  const { rows } = await db.query<PostRow>(`${postSelect} where p.deleted_at is null and ($1::bigint is null or p.id<$1) order by p.id desc limit 51`, [cursor]);
  return { posts: rows.slice(0, 50).map(postResult), nextCursor: rows.length > 50 ? String(rows[49].id) : null };
}
export async function getPost(db: Database, id: string) {
  if (!validPostId(id)) throw new ForumError("文章編號不正確。");
  const { rows } = await db.query<PostRow>(`${postSelect} where p.id=$1 and p.deleted_at is null`, [id]);
  return rows[0] ? postResult(rows[0]) : null;
}
export async function savePost(db: Database, user: ForumUser | null, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入再發文。", 401);
  const fields = validatePost(input);
  const values = [fields.title, fields.body, fields.board.slug, fields.images, fields.font, fields.fontSize, fields.regionCode];
  const result = input.id !== undefined
    ? await db.query(`update public.posts set title=$1,body=$2,board_id=(select id from public.boards where slug=$3),images=$4,font=$5,font_size=$6,
        region_code=case when $8 then $7 else region_code end where id=$9 returning id`, [...values, input.regionCode !== undefined, input.id])
    : await db.query(`insert into public.posts (title,body,board_id,images,font,font_size,region_code,author_id)
        values ($1,$2,(select id from public.boards where slug=$3),$4,$5,$6,$7,$8) returning id`, [...values, user.id]);
  if (!result.rows[0]) throw new ForumError("找不到文章，或你沒有編輯權限。", 403);
  return getPost(db, String(result.rows[0].id));
}
export async function listMappedPosts(db: Database, cursor: string | null = null) {
  if (cursor !== null && !validPostId(cursor)) throw new ForumError("地圖文章分頁編號不正確。");
  const { rows } = await db.query(`select p.id,p.title,p.region_code,p.created_at,u.display_name as author_name
    from public.posts p join public.profiles u on u.id=p.author_id
    where p.deleted_at is null and p.region_code is not null and ($1::bigint is null or p.id<$1) order by p.id desc limit 201`, [cursor]);
  const pins: ArticlePin[] = rows.slice(0, 200).map(row => ({ id: `post:${row.id}`, kind: "post", title: row.title, author: row.author_name,
    regionCode: row.region_code, createdAt: row.created_at.toISOString(), href: `/discussions/${row.id}` }));
  return { pins, nextCursor: rows.length > 200 ? String(rows[199].id) : null };
}

const columnSelect = `select c.*, p.display_name as author_name from public.expert_columns c join public.profiles p on p.id=c.author_id`;
type ColumnRow = { id: string; author_id: string; author_name: string; title: string; excerpt: string; body: string; region_code: string; created_at: Date; updated_at: Date };
const columnResult = (row: ColumnRow): ExpertColumnSummary => ({ id: row.id, authorId: row.author_id, author: row.author_name, title: row.title,
  excerpt: row.excerpt, regionCode: row.region_code, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
export async function listColumns(db: Database, offset = 0) {
  const { rows } = await db.query<ColumnRow>(`select c.id,c.author_id,c.title,c.excerpt,c.region_code,c.created_at,c.updated_at,p.display_name as author_name
    from public.expert_columns c join public.profiles p on p.id=c.author_id order by c.created_at desc,c.id limit 200 offset $1`, [offset]);
  return { columns: rows.map(columnResult), nextOffset: rows.length === 200 ? offset + 200 : null };
}
export async function getColumn(db: Database, id: string): Promise<ExpertColumn | null> {
  if (!validColumnId(id)) return null;
  const { rows } = await db.query<ColumnRow>(`${columnSelect} where c.id=$1`, [id]);
  return rows[0] ? { ...columnResult(rows[0]), body: rows[0].body } : null;
}
export async function saveColumn(db: Database, user: ForumUser | null, input: Record<string, unknown>) {
  if (!user) throw new ForumError("請先登入，再發表達人專欄。", 401);
  const fields = validateColumn(input);
  const values = [fields.title, fields.excerpt, fields.body, fields.regionCode];
  const result = input.id !== undefined
    ? await db.query("update public.expert_columns set title=$1,excerpt=$2,body=$3,region_code=$4 where id=$5 returning id", [...values, input.id])
    : await db.query("insert into public.expert_columns (title,excerpt,body,region_code,author_id) values ($1,$2,$3,$4,$5) returning id", [...values, user.id]);
  if (!result.rows[0]) throw new ForumError("找不到專欄，或你沒有編輯權限。", 403);
  return getColumn(db, result.rows[0].id);
}
