import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { CommunityHome } from "@/components/community/community-home";
import { ArticleMarkdown } from "@/components/community/article-markdown";
import { ArticleInteractions } from "@/components/community/article-interactions";
import { ExpertColumnEditLink } from "@/components/columns/expert-column-edit-link";
import { createClient } from "@/lib/db/server";
import { getColumn } from "@/lib/db/forum";
import { getRegion } from "@/lib/expert-columns";

const readColumn = cache(async (id: string) => getColumn(await createClient(), id));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await readColumn((await params).id);
  return article ? { title: `${article.title} — GreenThumb`, description: article.excerpt, openGraph: { type: "article", title: article.title, description: article.excerpt } } : { title: "找不到專欄 — GreenThumb" };
}
type Props = { params: Promise<{ id: string }> };
export default function CommunityColumnPage({ params }: Props) {
  return <CommunityHome view="columns"><Suspense fallback={<p role="status">載入在地專欄…</p>}><ColumnArticle params={params} /></Suspense></CommunityHome>;
}
async function ColumnArticle({ params }: Props) {
  await connection();
  const { id } = await params;
  const article = await readColumn(id);
  if (!article) notFound();
  const region = getRegion(article.regionCode);
  return <article className="editorial-article expert-column-article">
    <Link className="text-link" href="/columns#expert-map"><ArrowLeft size={16} />返回在地達人地圖</Link>
    <header className="editorial-article-heading sage"><p className="eyebrow">LOCAL GROWING STORIES</p><h1>{article.title}</h1><p>{article.excerpt}</p><div className="expert-article-meta"><span>{article.author}</span>{region && <span><MapPin size={14} />{region.county} · {region.district}</span>}</div></header>
    <ArticleMarkdown body={article.body} font="sans" fontSize={16} />
    <div className="expert-article-actions"><ExpertColumnEditLink id={article.id} authorId={article.authorId} /></div>
    <ArticleInteractions kind="column" id={article.id} title={article.title} path={`/columns/community/${article.id}`} />
  </article>;
}
