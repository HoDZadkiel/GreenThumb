import { CommunityHome } from "@/components/community/community-home";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { columns } from "@/lib/columns";

export default function Home() {
  const featured = columns[0];

  return (
    <CommunityHome>
      <section className="home-editorial" aria-labelledby="home-editorial-title">
        <div className="editorial-mark"><BookOpen size={24} strokeWidth={1.5} /></div>
        <div>
          <p className="eyebrow">編輯精選 · {featured.category}</p>
          <h2 id="home-editorial-title"><Link href={"/columns/" + featured.slug}>{featured.title}</Link></h2>
          <p>{featured.excerpt}</p>
        </div>
        <Link className="text-link" href="/columns">探索專欄 <ArrowUpRight size={16} /></Link>
      </section>
    </CommunityHome>
  );
}
