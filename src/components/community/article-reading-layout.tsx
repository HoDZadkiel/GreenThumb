import type { ReactNode } from "react";
import { createHash } from "node:crypto";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, Leaf, MapPin, PenLine, Sprout } from "lucide-react";
import { listEditorials } from "@/lib/editorial";
import { ArticleOutline } from "./article-outline";

type Props = {children:ReactNode;articleKey:string;title:string;body:string;author:string;category:string;location?:string;editorialSlug?:string};

export async function ArticleReadingLayout({children,articleKey,title,body,author,category,location,editorialSlug}:Props) {
  const related = (await listEditorials()).filter(article=>article.slug!==editorialSlug).slice(0,2);
  const minutes = Math.max(1,Math.ceil(Array.from(body).length/350));
  const contentId = `reading-${articleKey}`;
  const responsesId = `reading-responses-${articleKey}`;
  const version = createHash('sha256').update(title+'\0'+body).digest('hex').slice(0,16);
  return <div className="reading-layout">
    <aside className="reading-rail reading-left" aria-label="閱讀工具">
      <div className="reading-sticky">
        <Link href="/discussions" className="reading-back"><Sprout size={18}/>綠手指的日常</Link>
        <div className="reading-edition"><span>THE GROWING JOURNAL</span><p>每一片新葉，<br/>都有值得分享的故事。</p></div>
        <ArticleOutline key={version} contentId={contentId} responsesId={responsesId}/>
        <div className="reading-time"><Clock3 size={14}/><span>約 {minutes} 分鐘閱讀</span></div>
        <p className="reading-margin-note">慢慢讀，讓靈感生根。</p>
      </div>
    </aside>
    <div className="reading-main" id={contentId}>{children}</div>
    <aside className="reading-rail reading-right" aria-label="文章資訊與延伸閱讀">
      <div className="reading-sticky">
        <section className="reading-author-card">
          <p className="reading-rail-label">這篇故事來自</p>
          <div className="reading-author"><span className="reading-avatar" aria-hidden="true"><Leaf size={22}/></span><div><strong>{author}</strong><span>{category}</span></div></div>
          {location&&<p className="reading-location"><MapPin size={13}/>{location}</p>}
          <Link href={`#${responsesId}`} className="text-link">和作者聊聊 <ArrowUpRight size={14}/></Link>
        </section>
        {related.length>0&&<section className="reading-related"><p className="reading-rail-label"><BookOpen size={14}/>再讀一點綠生活</p>{related.map((article,index)=><Link key={article.slug} href={`/columns/${article.slug}`} className="reading-related-link" prefetch={false}><span className="reading-related-number">0{index+1}</span><div><small>{article.category}</small><h2>{article.title}</h2></div><ArrowUpRight size={14}/></Link>)}</section>}
        <section className="reading-invitation"><Sprout size={34} strokeWidth={1.2} aria-hidden="true"/><p className="eyebrow">YOUR NEXT GREEN STORY</p><h2>把你的種植日常，<br/>也寫成一篇故事。</h2><p>一個問題、一張新葉，<br/>都可能成為別人的靈感。</p><Link href="/discussions/write"><PenLine size={14}/>分享我的綠日常 <ArrowUpRight size={14}/></Link></section>
      </div>
    </aside>
  </div>;
}
