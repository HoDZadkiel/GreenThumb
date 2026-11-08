"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Bold, Check, CheckCircle2, ChevronRight, Columns2, Eye, Heading2, ImagePlus, Italic, Link as LinkIcon, List, PenLine, Quote, Save, Sprout, Strikethrough, X } from "lucide-react";
import { isImgBBImage, topics } from "@/lib/community-content";
import { articleFonts, articleFontSizes, type ArticleFont, type ArticleFontSize, type TrialPost } from "@/lib/trial-posts";
import { forumAction, type ForumPost } from "@/lib/trial-forum-client";
import { useCloudDraft } from "./use-cloud-draft";
import { ArticleMarkdown } from "./article-markdown";

const emptyDraft = { title: "", body: "", category: "觀葉植物", images: [] as string[], fontSize: 16 as ArticleFontSize, font: "sans" as ArticleFont };
const markdownTools = [
  { label: "標題", icon: Heading2, start: "\n\n## ", sample: "小標題", end: "\n\n" },
  { label: "粗體", icon: Bold, start: "**", sample: "重點文字", end: "**" },
  { label: "斜體", icon: Italic, start: "*", sample: "斜體文字", end: "*" },
  { label: "清單", icon: List, start: "\n\n- ", sample: "清單項目", end: "\n\n" },
  { label: "連結", icon: LinkIcon, start: "[", sample: "連結文字", end: "](https://example.com)" },
  { label: "刪除線", icon: Strikethrough, start: "~~", sample: "文字", end: "~~" },
  { label: "引用", icon: Quote, start: "\n\n> ", sample: "引用內容", end: "\n\n" },
];

function initialDraft(post?:TrialPost):typeof emptyDraft {
  if(post)return {...post,font:post.font??"sans",fontSize:post.fontSize??16};
  const board=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("board"):null;
  return {...emptyDraft,category:board&&topics.includes(board)?board:emptyDraft.category};
}

export function PostEditor({ post, canPublish, onRequireLogin, onPublished }: { post?: TrialPost; canPublish: boolean; onRequireLogin: () => void; onPublished: (post: ForumPost, warning: string) => void }) {
  const {draft,setDraft,saved:draftSaved,setSaved:setDraftSaved,saving:cloudSaving,loading:cloudLoading,error:cloudError,saveDraft:persistDraft}=useCloudDraft("discussion",()=>initialDraft(post),!!post);
  const [editorMode, setEditorMode] = useState<"write" | "split" | "preview">("write");
  const [showImages, setShowImages] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const editingId = post?.id;
  const [pending, setPending] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [unavailableImages, setUnavailableImages] = useState<string[]>([]);
  const [storageError, setStorageError] = useState("");

  async function publishTrialPost() {
    setStorageError("");
    if (imageUrl.trim()) {
      setShowImages(true);
      setImageError("請先加入圖片，或清空網址欄位。");
      return;
    }
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      setStorageError("請填寫討論標題和文章內容。");
      setEditorMode("write");
      if (!title) document.getElementById("post-title")?.focus();
      else editor.current?.focus();
      return;
    }
    if (!canPublish) {
      onRequireLogin();
      return;
    }
    let published: ForumPost;
    setPending(true);
    try {
      ({ post: published } = await forumAction("publish", { ...draft, title, body, id: editingId }));
    } catch (error) {
      setStorageError((error as Error).message);
      return;
    } finally {
      setPending(false);
    }
    setDraftSaved(false);
    onPublished(published, "");
  }

  async function saveDraft() {
    if (imageUrl.trim()) {
      setShowImages(true);
      setImageError("請先加入圖片，或清空網址欄位。");
      return;
    }
    await persistDraft();
  }

  function insertMarkdown(prefix: string, sample: string, suffix: string, inlineImage = false) {
    const end = editor.current?.selectionEnd ?? draft.body.length;
    const start = inlineImage ? end : editor.current?.selectionStart ?? end;
    const selection = draft.body.slice(start, end) || sample;
    const body = draft.body.slice(0, start) + prefix + selection + suffix + draft.body.slice(end);
    if (body.length > 5000) {
      setStorageError("插入後將超過內文的 5,000 字元上限。");
      return false;
    }
    setDraft({ ...draft, body });
    setDraftSaved(false);
    setStorageError("");
    if (editorMode === "preview") setEditorMode("write");
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(start + prefix.length, start + prefix.length + selection.length);
    });
    return true;
  }

  function addDraftImage() {
    const url = imageUrl.trim();
    if (!isImgBBImage(url)) {
      setImageError("請在 ImgBB 複製以 https://i.ibb.co/ 開頭的「直接連結」。");
      return;
    }
    const destination = url.replace(/[<>]/g, (char) => encodeURIComponent(char));
    if (!insertMarkdown("\n\n![", "植物照片", `](<${destination}>)\n\n`, true)) return;
    setImageUrl("");
    setImageError("");
    setDraftSaved(false);
  }


  if(cloudLoading)return <p role="status">載入雲端草稿…</p>;
  return (
    <form className="post-editor forum-editor" noValidate onSubmit={(event) => { event.preventDefault(); void publishTrialPost(); }}>
      {!canPublish && <div className="editor-login-note"><Sprout size={18} /><span>先把靈感寫下來，登入後可儲存雲端草稿與發表。</span><button type="button" onClick={onRequireLogin}>登入／註冊 <ChevronRight size={14} /></button></div>}
      <div className="writing-layout">
      <div className="writing-main">
      <section className="editor-document">
        <div className="editor-board-row"><label htmlFor="post-category">發表看板</label><select id="post-category" value={draft.category} onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setDraftSaved(false); }}>{topics.slice(1).map((item) => <option key={item}>{item}</option>)}</select><span><Sprout size={14} /> 找到懂你植物的同好</span></div>
        <div className="editor-title-field"><label htmlFor="post-title">討論標題 <span>必填</span></label><input id="post-title" name="title" value={draft.title} placeholder="用一句話，說說你的問題或新發現…" required maxLength={100} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDraftSaved(false); }} /><small>{draft.title.length} / 100</small></div>
      <div className="editor-mode-bar">
        <div className="composer-tabs" role="group" aria-label="編輯模式">
          <button type="button" aria-pressed={editorMode === "write"} onClick={() => setEditorMode("write")}><PenLine size={14} />撰寫</button>
          <button type="button" aria-pressed={editorMode === "split"} onClick={() => setEditorMode("split")}><Columns2 size={14} />對照</button>
          <button type="button" aria-pressed={editorMode === "preview"} onClick={() => setEditorMode("preview")}><Eye size={14} />預覽</button>
        </div>
        <span className="editor-save-indicator" role="status">{draftSaved ? <><Check size={13} /> 雲端草稿已儲存</> : "尚未儲存草稿"}</span>
      </div>
      <div className="editor-workspace" data-mode={editorMode}>
        <section className="composer-surface editor-source" aria-label="Markdown 編輯">
          <div className="editor-panel-heading">
            <label htmlFor="post-markdown">文章內容 <small>必填</small></label>
            <span>{draft.body.length.toLocaleString("zh-TW")} / 5,000</span>
          </div>
          <div className="composer-toolbar" role="group" aria-label="Markdown 格式工具">
            {markdownTools.map(({ label, icon: Icon, start, sample, end }) =>
              <button type="button" key={label} title={label} aria-label={label} onClick={() => insertMarkdown(start, sample, end)}><Icon size={16} /></button>)}
            <span className="toolbar-divider" />
            <button type="button" aria-expanded={showImages} aria-controls="editor-images" onClick={() => setShowImages(!showImages)}><ImagePlus size={16} />圖片</button>
            <label className="toolbar-font"><span className="sr-only">正文字體</span><select aria-label="正文字體" value={draft.font} onChange={(event) => { setDraft({ ...draft, font: event.target.value as ArticleFont }); setDraftSaved(false); }}>{Object.entries(articleFonts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="toolbar-font"><span className="sr-only">正文字級</span><select aria-label="正文字級" value={draft.fontSize} onChange={(event) => { setDraft({ ...draft, fontSize: Number(event.target.value) as ArticleFontSize }); setDraftSaved(false); }}>{Object.entries(articleFontSizes).map(([size, label]) => <option key={size} value={size}>{label}</option>)}</select></label>
          </div>
          <textarea ref={editor} id="post-markdown" value={draft.body} placeholder={"從一點觀察開始寫吧。\n\n可以聊聊植物的品種、種植環境、日照與澆水方式，\n或分享這段時間的新發現。"} rows={13} required maxLength={5000} aria-describedby="editor-writing-hint" onChange={(event) => { setDraft({ ...draft, body: event.target.value }); setDraftSaved(false); }} />
          <p id="editor-writing-hint" className="editor-writing-hint">支援 Markdown · 選取文字後，點上方工具即可套用格式。</p>
        </section>
        <section className="composer-surface editor-preview" aria-label="文章預覽">
          <div className="editor-panel-heading"><span>即時預覽</span></div>
          <div className="composer-preview">
            <span className="preview-board"><Sprout size={14} />{draft.category}</span>
            {draft.title.trim() && <h2>{draft.title}</h2>}
            {draft.body.trim()
              ? <ArticleMarkdown body={draft.body} font={draft.font} fontSize={draft.fontSize} />
              : <p>開始撰寫後，這裡會顯示發表時的排版。</p>}
          </div>
        </section>
      </div>
      </section>
      <fieldset className="draft-images" id="editor-images" hidden={!showImages}>
        <legend>在文章中插圖</legend>
        <p>在 ImgBB 上傳照片後貼上直接連結。圖片會插在內文游標位置，可修改 Markdown 中的圖片描述。</p>
        <a className="text-link" href="https://imgbb.com/" target="_blank" rel="noopener noreferrer">前往 ImgBB 上傳（新分頁） <ArrowUpRight size={15} /></a>
        <label htmlFor="draft-image-url">ImgBB 圖片直連</label>
        <div className="draft-image-input">
          <input id="draft-image-url" inputMode="url" value={imageUrl} placeholder="https://i.ibb.co/…" maxLength={2048} aria-describedby={imageError ? "draft-image-error" : undefined} aria-invalid={Boolean(imageError)} onChange={(event) => { setImageUrl(event.target.value); setImageError(""); setDraftSaved(false); }} />
          <button className="primary-button" type="button" onClick={addDraftImage}>插入圖片</button>
        </div>
        {imageError && <p id="draft-image-error" role="alert">{imageError}</p>}
        {draft.images.length > 0 && (
          <>
          <p>原有的文末附圖</p>
          <ul className="draft-image-list">
            {draft.images.map((url, index) => (
              <li key={url}>
                {unavailableImages.includes(url) ? <p>圖片暫時無法載入，可以移除並重新加入。</p> : (
                  <Image src={url} alt={"草稿照片 " + (index + 1)} width={120} height={90} unoptimized referrerPolicy="no-referrer" onError={() => setUnavailableImages((images) => [...images, url])} />
                )}
                <button type="button" className="text-link" aria-label={"移除圖片 " + (index + 1)} onClick={() => {
                  setDraft({ ...draft, images: draft.images.filter((image) => image !== url) });
                  setImageError("");
                  setDraftSaved(false);
                }}><X size={14} /> 移除</button>
              </li>
            ))}
          </ul>
          </>
        )}
      </fieldset>
      </div>
      <aside className="writing-guide" aria-label="發文小幫手">
        <span className="writing-guide-icon"><Sprout size={26} strokeWidth={1.4} /></span><p className="eyebrow">A GOOD PLACE TO START</p><h2>讓好問題，<br />長出好答案。</h2><p>多一點環境描述，同好就能少一點猜測。</p>
        <ul><li><CheckCircle2 size={15} /> 植物品種與種植地區</li><li><CheckCircle2 size={15} /> 放置位置、日照與通風</li><li><CheckCircle2 size={15} /> 澆水頻率與介質</li><li><CheckCircle2 size={15} /> 發生時間與植物近照</li></ul>
        <button className="trial-draft-button" type="button" disabled={Boolean(draft.body.trim())} onClick={() => { setDraft({ ...draft, body: "## 植物與環境\n- 植物品種：\n- 種植地區：\n- 日照與通風：\n\n## 平常的照顧方式\n- 澆水頻率：\n- 盆器與介質：\n\n## 想請教的問題\n\n" }); setDraftSaved(false); setEditorMode("write"); editor.current?.focus(); }}>套用發問範本 <ArrowRight size={14} /></button><small>內文空白時可套用，填上你的觀察即可。</small>
        <div className="writing-checklist"><h3>發表前確認</h3><p data-complete={Boolean(draft.title.trim())}><Check size={14} /> 寫好清楚的標題</p><p data-complete={Boolean(draft.body.trim())}><Check size={14} /> 加入內容與觀察</p><p data-complete={editorMode !== "write"}><Eye size={14} /> 切換預覽看看排版</p></div>
      </aside>
      </div>
      {(storageError || cloudError) && <p className="editor-error" role="alert">{storageError || cloudError}</p>}
      <div className="trial-actions editor-publish-bar">
        <span className="publish-destination"><Sprout size={16} />發表至 <strong>{draft.category}</strong></span>
        {!editingId && <button className="trial-draft-button" type="button" disabled={pending || cloudSaving} onClick={saveDraft}><Save size={15} />儲存草稿</button>}
        <button className="primary-button" type="submit" disabled={pending || cloudSaving}>{pending ? "儲存中…" : editingId ? "儲存文章修改" : canPublish ? "發表文章" : "登入並發表"} <ArrowRight size={16} /></button>
      </div>
    </form>
  );
}
