import type {Metadata} from 'next';
import {Suspense} from 'react';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {CommunityHome} from '@/components/community/community-home';
import {ArticleMarkdown} from '@/components/community/article-markdown';
import {ArticleInteractions} from '@/components/community/article-interactions';
import {getEditorial} from '@/lib/editorial';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const article=await getEditorial((await params).slug);
  return article ? {title:`${article.title} — GreenThumb`,description:article.excerpt,openGraph:{type:'article',title:article.title,description:article.excerpt}} : {title:'找不到專欄 — GreenThumb'};
}
async function Article({params}:Props){
  const {slug}=await params;
  const article=await getEditorial(slug);
  if(!article)notFound();
  return <article className="editorial-article">
    <Link className="text-link" href="/columns"><ArrowLeft size={16}/>返回專欄</Link>
    <header className={'editorial-article-heading '+article.color}>
      <p className="eyebrow">GREENTHUMB FIELD NOTES · {article.category}</p>
      <h1>{article.title}</h1><p>{article.excerpt}</p><small>{article.author_name}</small>
    </header>
    <ArticleMarkdown body={article.body} font="sans" fontSize={16}/>
    <ArticleInteractions kind="editorial" id={article.slug} title={article.title} path={`/columns/${article.slug}`}/>
  </article>;
}
export default function ColumnPage(props:Props){return <CommunityHome view="columns"><Suspense fallback={<p role="status">載入專欄…</p>}><Article {...props}/></Suspense></CommunityHome>;}
