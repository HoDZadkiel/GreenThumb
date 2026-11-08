export type TrialPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  images: string[];
  font?: ArticleFont | null;
  fontSize?: ArticleFontSize;
  regionCode?: string | null;
};

export const articleFonts = { sans: "黑體 · Noto Sans TC", serif: "宋體 · Noto Serif TC" } as const;
export type ArticleFont = keyof typeof articleFonts;
export const articleFontSizes = { 14: "小", 16: "標準", 18: "大" } as const;
export type ArticleFontSize = keyof typeof articleFontSizes;

export function isArticleFontSize(value: unknown): value is ArticleFontSize {
  return value === 14 || value === 16 || value === 18;
}
