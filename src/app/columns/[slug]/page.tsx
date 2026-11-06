import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CommunityHome } from "@/components/community/community-home";
import { columns } from "@/lib/columns";

type ColumnPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return columns.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ColumnPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = columns.find((item) => item.slug === slug);
  if (!article) return {};

  return { title: article.title + " — GreenThumb", description: article.excerpt };
}

export default async function ColumnPage({ params }: ColumnPageProps) {
  const { slug } = await params;
  const article = columns.find((item) => item.slug === slug);
  if (!article) notFound();

  return (
    <CommunityHome view="columns">
      <article className="editorial-article">
        <Link className="text-link" href="/columns"><ArrowLeft size={16} /> 返回專欄</Link>
        <header className={"editorial-article-heading " + article.color}>
          <p className="eyebrow">GREENTHUMB FIELD NOTES · {article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <small>GreenThumb 編輯室</small>
        </header>
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <Link className="text-link" href="/discussions">和植物同好聊聊 <ArrowRight size={16} /></Link>
      </article>
    </CommunityHome>
  );
}
