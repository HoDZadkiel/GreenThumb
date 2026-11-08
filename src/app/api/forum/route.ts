import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUser, getPost, listPosts, savePost } from "@/lib/supabase/forum";
import { ForumError, validateAuth } from "@/lib/forum-input.mjs";
import { failure, json, readInput } from "@/lib/forum-http";

export async function GET(request: NextRequest) {
  try {
    const client = await createClient();
    const user = await currentUser(client);
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const post = await getPost(client, id);
      return post ? json({ user, post }) : json({ error: "找不到文章。" }, 404);
    }
    return json({ user, ...await listPosts(client, request.nextUrl.searchParams.get("cursor")) });
  } catch (error) { return failure(error); }
}
function authFailure(code?: string) {
  if (code === "email_not_confirmed") return new ForumError("請先到信箱完成驗證，再登入。", 401);
  if (code === "invalid_credentials") return new ForumError("Email 或密碼不正確。", 401);
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return new ForumError("請求次數已達上限，請稍後再試。", 429);
  if (code === "email_address_not_authorized") return new ForumError("目前尚未開放此信箱註冊，請聯絡管理員設定驗證信服務。", 503);
  if (code === "user_already_exists") return new ForumError("此 Email 已註冊，請直接登入。", 409);
  if (code === "signup_disabled") return new ForumError("目前未開放註冊。", 403);
  return new ForumError("暫時無法完成登入或註冊，請稍後再試。", 503);
}
export async function POST(request: NextRequest) {
  try {
    const input = await readInput(request);
    const client = await createClient();
    if (input.action === "logout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw authFailure(error.code);
      return json({ ok: true });
    }
    if (input.action === "login" || input.action === "register") {
      const { email, password, name } = validateAuth(input, input.action === "register");
      if (input.action === "register") {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: new URL("/auth/callback", request.nextUrl.origin).href } });
        if (error) throw authFailure(error.code);
        if (!data.session) return json({ user: null, message: "註冊申請已送出，請到信箱完成驗證後再登入。若此信箱已註冊，請直接登入。" });
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw authFailure(error.code);
      }
      return json({ user: await currentUser(client) });
    }
    if (input.action !== "publish") throw new ForumError("不支援的操作。");
    const post = await savePost(client, await currentUser(client), input);
    return json({ post }, input.id !== undefined ? 200 : 201);
  } catch (error) { return failure(error); }
}
