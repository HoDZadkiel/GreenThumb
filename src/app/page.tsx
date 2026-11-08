import { CommunityHome } from "@/components/community/community-home";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { listEditorials } from "@/lib/editorial";
import { Suspense } from "react";

async function HomeEditorial() {
  const columns=await listEditorials().catch(()=>null);
  if(!columns) return <p role="alert">暫時無法載入編輯精選，請重新整理。</p>;
  const [featured, ...articles] = columns;
  if(!featured) return <section className="home-columns"><h1>種植專欄</h1><p>目前還沒有編輯精選。</p><Link href="/columns">查看在地專欄</Link></section>;

  return (
    <>
      <section className="home-columns" aria-labelledby="home-columns-title">
        <div className="home-columns-heading">
          <div><p className="eyebrow">GREENTHUMB FIELD NOTES</p><h1 id="home-columns-title">種植專欄<span className="heading-dot">.</span></h1></div>
          <Link className="text-link" href="/columns">所有專欄 <ArrowUpRight size={16} /></Link>
        </div>
        <div className="home-columns-grid">
          <Link className="home-column-feature" href={"/columns/" + featured.slug}>
            <div className="home-column-copy">
              <p className="eyebrow">編輯精選 · {featured.category}</p>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <span className="text-link">閱讀專欄 <ArrowUpRight size={16} /></span>
            </div>
            <div className="home-column-photo"><Image src="/images/plant-studio.png" alt="晨光照在龜背芋與陽台盆栽上" fill priority sizes="(max-width: 600px) 100vw, (max-width: 960px) 45vw, 33vw" /></div>
          </Link>
          <div className="home-column-list">
            {articles.map((article) => <Link className="home-column-card" key={article.slug} href={"/columns/" + article.slug}>
              <span className={"home-column-icon " + article.color}><BookOpen size={21} strokeWidth={1.5} /></span>
              <div><p className="eyebrow">{article.category}</p><h2>{article.title}</h2><p>{article.excerpt}</p></div>
              <ArrowUpRight size={17} />
            </Link>)}
          </div>
        </div>
      </section>
    </>
  );
}

export default function Home(){return <CommunityHome><Suspense fallback={<p role="status">載入編輯精選…</p>}><HomeEditorial /></Suspense></CommunityHome>;}
