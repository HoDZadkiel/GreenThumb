"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Eye, MapPin, PenLine, Save, Sprout } from "lucide-react";
import { CommunityHome } from "@/components/community/community-home";
import { useCommunitySession } from "@/components/community/community-session";
import { useCloudDraft } from "@/components/community/use-cloud-draft";
import { ArticleMarkdown } from "@/components/community/article-markdown";
import { getRegion, taiwanCounties, taiwanRegions, type ExpertColumn } from "@/lib/expert-columns";

const empty={title:"",excerpt:"",body:"",county:"",regionCode:""};
function initialDraft(post?:ExpertColumn){return post?{title:post.title,excerpt:post.excerpt,body:post.body,county:getRegion(post.regionCode)?.county??"",regionCode:post.regionCode}:{...empty};}

export function WriteExpertColumn() {
  const editId = useSearchParams().get("edit");
  return <CommunityHome view="expert-write"><ColumnComposerLoader key={editId ?? "new"} editId={editId} /></CommunityHome>;
}

function ColumnComposerLoader({ editId }: { editId: string | null }) {
  const { user, loading, requestLogin } = useCommunitySession();
  const [post, setPost] = useState<ExpertColumn | undefined>();
  const [fetching, setFetching] = useState(Boolean(editId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!editId) return;
    const controller = new AbortController();
    fetch(`/api/expert-columns?id=${encodeURIComponent(editId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then((result) => setPost(result.column))
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [editId]);
  if (loading || fetching) return <p role="status">載入專欄編輯器…</p>;
  if (error) return <p className="editor-error" role="alert">{error}</p>;
  if (editId && !user) return <div className="write-notice"><p>登入後可編輯自己的專欄及所在地區。</p><button className="primary-button" onClick={requestLogin}>登入或註冊</button></div>;
  if (editId && (!post || (user?.role === "member" && post.authorId !== user?.id))) return <p className="editor-error" role="alert">找不到專欄，或你沒有編輯權限。</p>;
  return <ColumnForm post={post} />;
}

function ColumnForm({ post }: { post?: ExpertColumn }) {
  const { user, requestLogin } = useCommunitySession();
  const router = useRouter();
  const {draft,setDraft,saved,setSaved,saving:cloudSaving,loading:cloudLoading,error:cloudError,saveDraft}=useCloudDraft("column",()=>initialDraft(post),!!post);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const region = getRegion(draft.regionCode);
  function update(field: keyof typeof empty, value: string) { setDraft((current) => ({ ...current, [field]: value })); setSaved(false); }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region || !draft.title.trim() || !draft.excerpt.trim() || !draft.body.trim()) {
      setError("請選擇縣市與鄉鎮市區，並填寫標題、簡介及內文。");
      setPreview(false);
      return;
    }
    if (!user) { requestLogin(); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/expert-columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...(post ? { id: post.id } : {}), title: draft.title, excerpt: draft.excerpt, body: draft.body, regionCode: draft.regionCode,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/columns/community/${result.column.id}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "無法連線，請稍後再試。"); }
    finally { setPending(false); }
  }

  if(cloudLoading)return <p role="status">載入雲端草稿…</p>;
  return <section className="write-page expert-composer" aria-labelledby="expert-write-title">
    <nav className="breadcrumbs" aria-label="麵包屑"><Link href="/">首頁</Link><ChevronRight size={13} /><Link href="/columns#expert-map">在地達人地圖</Link><ChevronRight size={13} /><span>{post ? "編輯專欄" : "發表專欄"}</span></nav>
    <header className="write-intro"><div><p className="eyebrow">YOUR GROWING STORY, YOUR CORNER OF TAIWAN</p><h1 id="expert-write-title">{post ? "編輯在地專欄" : "把你的種植故事，放上地圖。"}</h1></div></header>
    {!user && <div className="editor-login-note"><Sprout size={18} /><span>可先撰寫，登入後可儲存雲端草稿與發表。</span><button type="button" onClick={requestLogin}>登入／註冊 <ChevronRight size={14} /></button></div>}
    <form className="expert-column-form" noValidate onSubmit={publish}>
      <div className="expert-composer-layout"><div className="expert-composer-fields">
        <fieldset className="expert-region-fields"><legend><MapPin size={17} />專欄所在地</legend><p>選擇你的種植區域，發表後會以區域圖釘顯示。</p><div>
          <label>縣市<select aria-label="專欄所在縣市" required value={draft.county} onChange={(event) => { setDraft({ ...draft, county: event.target.value, regionCode: "" }); setSaved(false); }}><option value="">選擇縣市</option>{taiwanCounties.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>鄉鎮市區<select aria-label="專欄所在鄉鎮市區" required disabled={!draft.county} value={draft.regionCode} onChange={(event) => update("regionCode", event.target.value)}><option value="">選擇鄉鎮市區</option>{taiwanRegions.filter((item) => item.county === draft.county).map((item) => <option key={item.code} value={item.code}>{item.district}</option>)}</select></label>
        </div>{region && <span className="expert-location-confirm"><MapPin size={13} />{region.county} · {region.district}</span>}</fieldset>
        <label>專欄標題 <span aria-hidden="true">{draft.title.length} / 100</span><input required maxLength={100} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="例如：在台南，把香草種進日常" /></label>
        <label>專欄簡介 <span aria-hidden="true">{draft.excerpt.length} / 200</span><textarea required rows={2} maxLength={200} value={draft.excerpt} onChange={(event) => update("excerpt", event.target.value)} placeholder="介紹你種的植物、環境和想分享的經驗。" /></label>
        <div className="expert-body-heading"><label htmlFor="expert-column-body">專欄內文 <small aria-hidden="true">{draft.body.length.toLocaleString("zh-TW")} / 5,000</small></label><div role="group" aria-label="專欄編輯模式"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><PenLine size={14} />撰寫</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={14} />預覽</button></div></div>
        <textarea className={preview ? "expert-body-hidden" : "expert-body-input"} id="expert-column-body" required rows={14} maxLength={5000} value={draft.body} onChange={(event) => update("body", event.target.value)} placeholder="從你的種植環境開始，寫下在地氣候、照顧方法，以及這段時間的觀察。支援 Markdown 排版。" />
        {preview && <div className="expert-body-preview"><h2>{draft.title || "專欄預覽"}</h2>{draft.body.trim() ? <ArticleMarkdown body={draft.body} font="sans" fontSize={16} /> : <p>寫下內容後，就能在這裡預覽排版。</p>}</div>}
      </div><aside className="expert-composer-note"><span><MapPin size={26} /></span><h2>一個地點，<br />一段綠色日常。</h2><p>分享你所在區域的日照、溫度與種植心得，讓同樣氣候裡的同好更容易找到你。</p><ul><li><Check size={15} />選擇縣市與鄉鎮市區</li><li><Check size={15} />專欄發表後自動落針</li><li><Check size={15} />日後可編輯內容及所在地</li></ul><small>圖釘為區域代表位置。</small></aside></div>
      {(error || cloudError) && <p className="editor-error" role="alert">{error || cloudError}</p>}
      <div className="editor-publish-bar trial-actions"><span className="publish-destination"><MapPin size={16} />{region ? `${region.county} · ${region.district}` : "選擇所在地，讓故事在地圖上發芽"}</span>{saved && <span className="save-status" role="status">雲端草稿已儲存</span>}{!post && <button className="trial-draft-button" type="button" onClick={saveDraft} disabled={pending || cloudSaving}><Save size={15} />儲存草稿</button>}<button className="primary-button" type="submit" disabled={pending || cloudSaving}>{pending ? "儲存中…" : post ? "儲存專欄修改" : user ? "發表並加入地圖" : "登入並發表"}<ArrowRight size={16} /></button></div>
    </form>
  </section>;
}
