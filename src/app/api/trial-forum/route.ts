import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isImgBBImage, maxDraftImages, topics } from "@/lib/community-content";
import { isArticleFontSize } from "@/lib/trial-posts";
import {
  createTrialSession, createTrialUser, findTrialUser, getTrialDatabase,
  getTrialSession, revokeTrialSession, sessionAge,
} from "@/lib/trial-forum-db.mjs";

const sessionCookie = "greenthumb_trial_session";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function GET(request: NextRequest) {
  if (process.env.GREENTHUMB_TRIAL_AUTH !== "1") return json({ user: null, posts: [] });
  const user = getTrialSession(request.cookies.get(sessionCookie)?.value);
  const posts = getTrialDatabase().prepare(`
    select posts.id, title, body, category, images, font, font_size as fontSize, users.name as author,
           posts.author_id as authorId
    from posts join users on users.id = posts.author_id order by posts.rowid desc
  `).all();
  return json({ user, posts: posts.map((post: Record<string, unknown>) => ({
    ...post, images: JSON.parse(String(post.images)),
  })) });
}

export async function POST(request: NextRequest) {
  if (process.env.GREENTHUMB_TRIAL_AUTH !== "1") return json({ error: "本機試用未啟用。" }, 503);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && origin !== `${request.nextUrl.protocol}//${host}`) return json({ error: "請從 GreenThumb 操作。" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "請求格式不正確。" }, 415);
  }

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "請求格式不正確。" }, 400);
  const currentToken = request.cookies.get(sessionCookie)?.value;

  try {
    if (data.action === "logout") {
      revokeTrialSession(currentToken);
      const response = json({ ok: true });
      response.cookies.delete(sessionCookie);
      return response;
    }

    if (data.action === "login" || data.action === "register") {
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const password = typeof data.password === "string" ? data.password : "";
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 128) {
        return json({ error: "請輸入有效的 Email 和密碼。" }, 400);
      }
      if (data.action === "register") {
        if (!name || name.length > 40 || password.length < 12) {
          return json({ error: "請填寫 1–40 字的暱稱，密碼至少 12 字元。" }, 400);
        }
        if (getTrialDatabase().prepare("select 1 from users where email = ?").get(email)) {
          return json({ error: "此 Email 已註冊，請直接登入。" }, 409);
        }
      }
      const user = data.action === "register"
        ? createTrialUser(email, name, password)
        : findTrialUser(email, password);
      if (!user) return json({ error: "Email 或密碼不正確。" }, 401);
      revokeTrialSession(currentToken);
      const response = json({ user });
      response.cookies.set(sessionCookie, createTrialSession(user.id), {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: sessionAge,
        secure: request.nextUrl.protocol === "https:",
      });
      return response;
    }

    if (data.action !== "publish") return json({ error: "不支援的操作。" }, 400);
    const user = getTrialSession(currentToken);
    if (!user) return json({ error: "請先登入再發文。" }, 401);

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const body = typeof data.body === "string" ? data.body.trim() : "";
    const category = data.category;
    const images = data.images;
    const font = data.font ?? null;
    const fontSize = data.fontSize ?? 16;
    if (!title || title.length > 100 || !body || body.length > 5000 ||
        (font !== null && font !== "sans" && font !== "serif") || !isArticleFontSize(fontSize) ||
        !topics.slice(1).includes(category) || !Array.isArray(images) ||
        images.length > maxDraftImages || !images.every((url) => isImgBBImage(url) && url.length <= 2048)) {
      return json({ error: "請檢查標題、內文、分類與圖片連結。" }, 400);
    }

    const db = getTrialDatabase();
    let id = randomUUID();
    if (typeof data.id === "string") {
      id = data.id;
      const result = db.prepare(`
        update posts set title = ?, body = ?, category = ?, images = ?, font = ?, font_size = ?
        where id = ? and (author_id = ? or ? = 'admin')
      `).run(title, body, category, JSON.stringify(images), font, fontSize, id, user.id, user.role);
      if (!result.changes) return json({ error: "你無權編輯這篇文章。" }, 403);
    } else {
      db.prepare("insert into posts (id, author_id, title, body, category, images, font, font_size) values (?, ?, ?, ?, ?, ?, ?, ?)").run(id, user.id, title, body, category, JSON.stringify(images), font, fontSize);
    }
    const author = db.prepare("select users.name as author, users.id as authorId from posts join users on users.id = posts.author_id where posts.id = ?").get(id);
    return json({ post: { id, title, body, category, images, font, fontSize, ...author } }, data.id === id ? 200 : 201);
  } catch {
    return json({ error: "暫時無法儲存，請稍後再試。" }, 500);
  }
}
