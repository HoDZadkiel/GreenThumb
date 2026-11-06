import { isImgBBImage, maxDraftImages, topics } from "./community-content";

export type TrialPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  images: string[];
  font?: ArticleFont | null;
  fontSize?: ArticleFontSize;
};

export const articleFonts = { sans: "黑體 · Noto Sans TC", serif: "宋體 · Noto Serif TC" } as const;
export type ArticleFont = keyof typeof articleFonts;
export const articleFontSizes = { 14: "小", 16: "標準", 18: "大" } as const;
export type ArticleFontSize = keyof typeof articleFontSizes;

export function isArticleFontSize(value: unknown): value is ArticleFontSize {
  return value === 14 || value === 16 || value === 18;
}

const key = "greenthumb-trial-posts";

export function subscribeToTrialPosts(update: () => void) {
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener("storage", update);
  };
}

export function getTrialPostsSnapshot() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readTrialPosts(snapshot: string | null): TrialPost[] {
  if (!snapshot) return [];
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((post): post is TrialPost =>
      post && typeof post.id === "string" && typeof post.title === "string" &&
      typeof post.body === "string" && topics.slice(1).includes(post.category) &&
      Array.isArray(post.images) && post.images.length <= maxDraftImages && post.images.every(isImgBBImage));
  } catch {
    return [];
  }
}
