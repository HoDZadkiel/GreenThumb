import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { currentUser, getPost, listPosts, savePost } from "@/lib/db/forum";
import { ForumError } from "@/lib/forum-input.mjs";
import { authAvailability } from "@/lib/auth/config.mjs";
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
    return json({ user, auth: authAvailability(), ...await listPosts(client, request.nextUrl.searchParams.get("cursor")) });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const input = await readInput(request);
    const client = await createClient();
    if (input.action === "login" || input.action === "register") {
      throw new ForumError("請從登入視窗使用帳密、Google 或 Email 驗證碼登入。", 410);
    }
    if (input.action !== "publish") throw new ForumError("不支援的操作。");
    const post = await savePost(client, await currentUser(client), input);
    return json({ post }, input.id !== undefined ? 200 : 201);
  } catch (error) { return failure(error); }
}
