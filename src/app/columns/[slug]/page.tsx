import type {Metadata} from 'next';
import {Suspense} from 'react';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {CommunityHome} from '@/components/community/community-home';
import {ArticleMarkdown} from '@/components/community/article-markdown';
import {getEditorial} from '@/lib/editorial';
type Props={params:Promise<{slug:string}>};
export const metadata:Metadata={title:'種植專欄 — GreenThumb'};
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
    <Link className="text-link" href="/discussions">和植物同好聊聊 <ArrowRight size={16}/></Link>
  </article>;
}
export default function ColumnPage(props:Props){return <CommunityHome view="columns"><Suspense fallback={<p role="status">載入專欄…</p>}><Article {...props}/></Suspense></CommunityHome>;}
