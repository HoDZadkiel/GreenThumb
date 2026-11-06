import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import { CommunityHome } from "@/components/community/community-home";
import { columns } from "@/lib/columns";

export const metadata: Metadata = {
  title: "種植專欄 — GreenThumb",
  description: "讀一篇種植筆記、實用教學或社群手記，為自己的綠日常找靈感。",
};

export default function ColumnsPage() {
  const [featured, ...articles] = columns;

  return (
    <CommunityHome view="columns">
      <section className="editorial-hero" aria-labelledby="columns-title">
        <div className="editorial-hero-copy">
          <p className="eyebrow">GREENTHUMB FIELD NOTES</p>
          <h1 id="columns-title">種植專欄</h1>
          <p>把照顧植物的日常寫下來。從種植筆記、拍照方法，到能幫助下一位園丁的經驗。</p>
          <div className="editorial-feature">
            <p className="eyebrow">本期精選 · {featured.category}</p>
            <h2>{featured.title}</h2>
            <Link className="primary-button" href={"/columns/" + featured.slug}>閱讀專欄 <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className="editorial-cover">
          <Image src="/images/plant-studio.png" alt="晨光照在陽台的綠葉與盆栽上" fill sizes="(max-width: 760px) 100vw, 50vw" priority />
          <span>FIELD NOTES / 01</span>
        </div>
      </section>
      <div className="content-grid">
        <section aria-labelledby="more-columns">
          <div className="section-heading">
            <div><p className="eyebrow">KEEP READING</p><h2 id="more-columns">更多種植筆記<span className="heading-dot">.</span></h2></div>
          </div>
          <div className="editorial-grid">
            {articles.map((article) => (
              <Link className="editorial-card" key={article.slug} href={"/columns/" + article.slug}>
                <span className={"editorial-card-mark " + article.color}><BookOpen size={24} strokeWidth={1.5} /></span>
                <span className="eyebrow">{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <span className="text-link">閱讀文章 <ArrowUpRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="editorial-aside">
          <p className="eyebrow">FROM READING TO GROWING</p>
          <h2>讀完，換你說說看。</h2>
          <p>同一種植物，放在不同窗邊就有不同故事。來看看其他人怎麼種。</p>
          <Link className="text-link" href="/discussions">前往討論區 <ArrowRight size={16} /></Link>
        </aside>
      </div>
    </CommunityHome>
  );
}
