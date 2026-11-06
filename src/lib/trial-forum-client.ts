import type { TrialPost } from "./trial-posts";

export type ForumPost = TrialPost & { author: string; authorId: string };

export async function forumAction(action: string, fields: object = {}) {
  const response = await fetch("/api/trial-forum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, action }),
  }).catch(() => { throw new Error("無法連線，請稍後再試。"); });
  const result = await response.json().catch(() => { throw new Error("伺服器暫時無法處理請求。"); });
  if (!response.ok) throw new Error(result.error);
  return result;
}
