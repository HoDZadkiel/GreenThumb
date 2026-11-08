export type ArticleKind = "post" | "column" | "editorial";
export type ArticleReply = {
  id: string;
  author: string;
  authorId: string;
  body: string;
  createdAt: string;
};
export type ArticleInteractions = {
  liked: boolean;
  likeCount: number;
  replyCount: number;
  canReply: boolean;
  replies: ArticleReply[];
  nextCursor: string | null;
};
