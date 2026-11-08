"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, Compass, MapPin, PenLine, RotateCcw, Search, Sprout } from "lucide-react";
import { getRegion, taiwanCounties, type ColumnPin, type ExpertColumnSummary } from "@/lib/expert-columns";

const TaiwanMapCanvas = dynamic(() => import("./taiwan-map-canvas"), { ssr: false,
  loading: () => <div className="map-placeholder" role="status"><Compass size={28} />正在展開台灣地圖…</div> });

export function ExpertColumnMap() {
  const [columns, setColumns] = useState<ExpertColumnSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [county, setCounty] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadColumns() {
      const columns: ExpertColumnSummary[] = [];
      let offset: number | null = 0;
      do {
        const response: Response = await fetch(`/api/expert-columns?offset=${offset}`, { signal: controller.signal, cache: "no-store" });
        const result: { columns: ExpertColumnSummary[]; nextOffset: number | null; error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error);
        columns.push(...result.columns);
        offset = result.nextOffset;
      } while (offset !== null);
      return { columns };
    }
    loadColumns()
      .then((result) => { setColumns(result.columns); setError(""); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "無法載入專欄。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const pins = useMemo<ColumnPin[]>(() => columns.map((column) => ({
    id: column.id, title: column.title, author: column.author, regionCode: column.regionCode, href: `/columns/community/${column.id}`,
  })), [columns]);
  const filtered = useMemo(() => pins.filter((pin) => {
    const region = getRegion(pin.regionCode);
    return region && (!county || region.county === county) &&
      `${pin.title} ${pin.author} ${region.county}${region.district}`.toLocaleLowerCase().replace(/台/g, "臺").includes(query.trim().toLocaleLowerCase().replace(/台/g, "臺"));
  }), [pins, county, query]);
  const areas = new Set(filtered.map((pin) => pin.regionCode)).size;
  function reset() { setCounty(""); setQuery(""); setSelectedId(null); setVisibleCount(6); setResetKey((value) => value + 1); }

  return <section className="expert-map-section" id="expert-map" aria-labelledby="expert-map-title">
    <div className="expert-map-heading"><div><p className="eyebrow">GROWING STORIES ACROSS TAIWAN</p><h2 id="expert-map-title">在地達人地圖<span className="heading-dot">.</span></h2><p>從一個地方，認識一位懂植物的人。點圖釘，讀讀他們的種植日常。</p></div><Link className="primary-button" href="/columns/write"><PenLine size={16} />發表在地專欄</Link></div>
    <div className="expert-map-toolbar">
      <label><MapPin size={16} /><span className="sr-only">依縣市查看專欄</span><select aria-label="依縣市查看專欄" value={county} onChange={(event) => { setCounty(event.target.value); setSelectedId(null); setVisibleCount(6); }}><option value="">全台灣</option>{taiwanCounties.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="expert-map-search"><Search size={16} /><input aria-label="搜尋達人、植物或地區" value={query} placeholder="找達人、植物或地區…" onChange={(event) => { setQuery(event.target.value); setSelectedId(null); setVisibleCount(6); }} /></label>
      <button type="button" className="map-reset-button" onClick={reset}><Compass size={15} />查看全台</button>
      <button type="button" className="map-reset-button" aria-label="重新載入達人專欄" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RotateCcw size={15} /></button>
    </div>
    {error && <p className="editor-error" role="alert">{error}</p>}
    <div className="expert-map-layout">
      <div className="expert-map-panel"><TaiwanMapCanvas pins={filtered} selectedId={selectedId} county={county} resetKey={resetKey} onSelect={setSelectedId} /><div className="expert-map-legend"><span><i />達人專欄</span><span>數字代表鄰近圖釘，點擊可展開</span></div></div>
      <aside className="map-column-sidebar" aria-label="地圖上的專欄">
        <div className="map-list-heading"><h3>{county || "全台灣"}的種植故事</h3><span>{filtered.length} 篇專欄 · {areas} 個區域</span></div>
        {loading && <p className="map-list-status" role="status">正在尋找在地專欄…</p>}
        {!loading && filtered.length === 0 && <div className="map-empty"><Sprout size={32} strokeWidth={1.3} /><h4>{pins.length ? "還沒有符合的專欄" : "讓第一個故事，在這裡發芽"}</h4><p>{pins.length ? "換個縣市或關鍵字，看看其他地方的綠日常。" : "發表專欄時填寫所在地區，你的故事就會成為地圖上的一枚圖釘。"}</p>{pins.length ? <button className="text-link" onClick={reset}>清除篩選</button> : <Link className="text-link" href="/columns/write">發表第一篇在地專欄 <ArrowUpRight size={14} /></Link>}</div>}
        <div className="map-column-list">
          {filtered.slice(0, visibleCount).map((pin) => {
            const region = getRegion(pin.regionCode)!;
            return <article className={selectedId === pin.id ? "map-column-card selected" : "map-column-card"} key={pin.id}>
              <button aria-pressed={selectedId === pin.id} onClick={() => setSelectedId(pin.id)}><span className="map-card-location"><MapPin size={13} />{region.county} · {region.district}</span><h4>{pin.title}</h4><span className="map-card-author">{pin.author}</span></button>
              <Link href={pin.href}>閱讀專欄 <ArrowUpRight size={13} /></Link>
            </article>;
          })}
        </div>
        {filtered.length > visibleCount && <button className="map-load-more" onClick={() => setVisibleCount((count) => count + 6)}>顯示更多專欄（還有 {filtered.length - visibleCount} 篇）</button>}
      </aside>
    </div>
    <p className="expert-map-footnote"><MapPin size={13} />圖釘依所選鄉鎮市區的代表位置標示。<span>同區有多篇專欄時，放大後點群聚圖釘即可展開。</span></p>
  </section>;
}
