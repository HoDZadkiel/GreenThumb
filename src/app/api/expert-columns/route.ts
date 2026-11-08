import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUser, getColumn, listColumns, saveColumn } from "@/lib/supabase/forum";
import { ForumError } from "@/lib/forum-input.mjs";
import { failure, json, readInput } from "@/lib/forum-http";
export async function GET(request: NextRequest) {
  try {
    const client = await createClient();
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const column = await getColumn(client, id);
      return column ? json({ column }) : json({ error: "找不到專欄。" }, 404);
    }
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0) throw new ForumError("專欄分頁不正確。");
    return json({ ...await listColumns(client, offset), enabled: true });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const input = await readInput(request);
    const client = await createClient();
    const column = await saveColumn(client, await currentUser(client), input);
    return json({ column }, input.id !== undefined ? 200 : 201);
  } catch (error) { return failure(error); }
}
