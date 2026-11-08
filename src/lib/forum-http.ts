import { NextRequest, NextResponse } from "next/server";
import { ForumError } from "./forum-input.mjs";
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export const failure = (error: unknown) => error instanceof ForumError ? json({ error: error.message }, error.status) : json({ error: "暫時無法處理請求，請稍後再試。" }, 503);
export async function readInput(request: NextRequest): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== `${request.nextUrl.protocol}//${request.headers.get("host")}`) throw new ForumError("請從 GreenThumb 操作。", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ForumError("請求格式不正確。", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ForumError("請求格式不正確。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64000) { await reader.cancel(); throw new ForumError("內容過長。", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ForumError("請求格式不正確。"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ForumError("請求格式不正確。");
  return input;
}
