import type { TrialPost } from "./trial-posts";
import { memberRequest } from './member-client';

export type ForumPost = TrialPost & { author: string; authorId: string; createdAt: string; likeCount: number; replyCount: number; region: string | null; postType: string };
export type ForumPostSummary = Omit<ForumPost, "body" | "images" | "font" | "fontSize"> & { excerpt: string };

export function forumAction(action: string, fields: object, expectedUserId: string) {
  return memberRequest('/api/forum', { ...fields, action }, expectedUserId);
}
