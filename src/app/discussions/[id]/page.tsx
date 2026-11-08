import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { CommunityHome } from "@/components/community/community-home";
import { ArticleMarkdown } from "@/components/community/article-markdown";
import { ArticleInteractions } from "@/components/community/article-interactions";
import { DiscussionEditLink } from "@/components/community/discussion-edit-link";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/supabase/forum";
import { validPostId } from "@/lib/forum-input.mjs";
import { getRegion } from "@/lib/expert-columns";

type Props = { params: Promise<{ id: string }> };
const readPost = cache(async (id: string) => validPostId(id) ? getPost(await createClient(), id) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await readPost((await params).id);
  if (!post) return { title: "找不到文章 — GreenThumb" };
  return { title: `${post.title} — GreenThumb`, description: post.body.slice(0, 160), openGraph: { type: "article", title: post.title, description: post.body.slice(0, 160) } };
}

async function DiscussionArticle({ params }: Props) {
  const { id } = await params;
  const post = await readPost(id);
  if (!post) notFound();
  const regionNames: Record<string, string> = { north: "北部", central: "中部", south: "南部", east: "東部", island: "離島", indoor: "室內", highland: "高山" };
  const types: Record<string, string> = { question: "發問", share: "分享", guide: "教學" };
  const location = getRegion(post.regionCode ?? "");
  return <article className="editorial-article discussion-article">
    <nav className="article-navigation" aria-label="文章導覽"><Link className="text-link" href="/discussions"><ArrowLeft size={16} />返回討論區</Link><DiscussionEditLink id={post.id} authorId={post.authorId} /></nav>
    <header className="editorial-article-heading sage">
      <p className="eyebrow">{post.category} · {types[post.postType] ?? "討論"}</p>
      <h1>{post.title}</h1>
      <div className="expert-article-meta"><span>{post.author}</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}</time>{location ? <Link className="article-location-link" href="/columns#expert-map"><MapPin size={14} />{location.county} · {location.district}</Link> : post.region && <span><MapPin size={14} />{regionNames[post.region] ?? post.region}</span>}</div>
    </header>
    {post.font ? <ArticleMarkdown body={post.body} font={post.font} fontSize={post.fontSize} /> : <div className="article-plain-body">{post.body}</div>}
    {post.images.length > 0 && <ul className="discussion-article-photos">{post.images.map((url, index) => <li key={url}><Image src={url} alt={`植物照片 ${index + 1}`} width={760} height={480} unoptimized referrerPolicy="no-referrer" /></li>)}</ul>}
    <ArticleInteractions kind="post" id={post.id} title={post.title} path={`/discussions/${post.id}`} />
  </article>;
}

export default function DiscussionPage(props: Props) {
  return <CommunityHome view="article"><Suspense fallback={<p role="status">載入文章…</p>}><DiscussionArticle {...props} /></Suspense></CommunityHome>;
}
