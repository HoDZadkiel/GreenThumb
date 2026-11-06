"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { isImgBBImage, maxDraftImages, topics } from "@/lib/community-content";
import { articleFonts, articleFontSizes, isArticleFontSize, type ArticleFont, type ArticleFontSize, type TrialPost } from "@/lib/trial-posts";
import { forumAction, type ForumPost } from "@/lib/trial-forum-client";
import { ArticleMarkdown } from "./article-markdown";

const emptyDraft = { title: "", body: "", category: "觀葉植物", images: [] as string[], fontSize: 16 as ArticleFontSize, font: "sans" as ArticleFont };
const markdownTools = [
  { label: "標題", start: "\n\n## ", sample: "小標題", end: "\n\n" },
  { label: "粗體", start: "**", sample: "重點文字", end: "**" },
  { label: "斜體", start: "*", sample: "斜體文字", end: "*" },
  { label: "清單", start: "\n\n- ", sample: "清單項目", end: "\n\n" },
  { label: "連結", start: "[", sample: "連結文字", end: "](https://example.com)" },
  { label: "刪除線", start: "~~", sample: "文字", end: "~~" },
  { label: "引用", start: "\n\n> ", sample: "引用內容", end: "\n\n" },
];

const draftKey = "greenthumb-draft";

function initialDraft(post?: TrialPost): typeof emptyDraft {
  if (post) return { ...post, font: post.font ?? "sans", fontSize: post.fontSize ?? 16 };
  try {
    const stored = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    if (stored && typeof stored.title === "string" && typeof stored.body === "string") {
      const images = Array.isArray(stored.images) ? stored.images.filter(isImgBBImage).slice(0, maxDraftImages) : [];
      const category = topics.slice(1).includes(stored.category) ? stored.category : emptyDraft.category;
      return { title: stored.title, body: stored.body, category, images,
        font: stored.font === "serif" ? "serif" : "sans",
        fontSize: isArticleFontSize(stored.fontSize) ? stored.fontSize : 16 };
    }
  } catch {
    return emptyDraft;
  }
  return emptyDraft;
}

export function PostEditor({ post, onPublished }: { post?: TrialPost; onPublished: (post: ForumPost, warning: string) => void }) {
  const [draft, setDraft] = useState(() => initialDraft(post));
  const [preview, setPreview] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const editingId = post?.id;
  const [pending, setPending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [unavailableImages, setUnavailableImages] = useState<string[]>([]);
  const [storageError, setStorageError] = useState("");

  async function publishTrialPost() {
    setStorageError("");
    if (imageUrl.trim()) {
      setImageError("請先加入圖片，或清空網址欄位。");
      return;
    }
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      setStorageError("請填寫討論標題和文章內容。");
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
    let warning = "";
    if (!editingId) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        warning = "文章已儲存，舊草稿無法清除。";
      }
    }
    onPublished(published, warning);
  }

  function saveDraft() {
    if (imageUrl.trim()) {
      setImageError("請先加入圖片，或清空網址欄位。");
      return;
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftSaved(true);
      setStorageError("");
    } catch {
      setStorageError("瀏覽器無法儲存草稿，請先複製內容以免遺失。");
    }
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
    setPreview(false);
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


  return (
    <form className="post-editor" onSubmit={(event) => { event.preventDefault(); void publishTrialPost(); }}>
      <div className="editor-settings">
        <label>討論標題
          <input name="title" value={draft.title} placeholder="想分享的發現，或想請教的問題" required maxLength={100} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDraftSaved(false); }} />
        </label>
        <label>植物分類
          <select value={draft.category} onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setDraftSaved(false); }}>
            {topics.slice(1).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="composer-font">正文字體
          <select value={draft.font} onChange={(event) => { setDraft({ ...draft, font: event.target.value as ArticleFont }); setDraftSaved(false); }}>
            {Object.entries(articleFonts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>正文字級
          <select value={draft.fontSize} onChange={(event) => { setDraft({ ...draft, fontSize: Number(event.target.value) as ArticleFontSize }); setDraftSaved(false); }}>
            {Object.entries(articleFontSizes).map(([size, label]) => <option key={size} value={size}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="composer-tabs" aria-label="編輯模式">
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>撰寫</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>預覽</button>
      </div>
      <div className="editor-workspace" data-preview={preview}>
        <section className="composer-surface editor-source" aria-label="Markdown 編輯">
          <div className="editor-panel-heading">
            <label htmlFor="post-markdown">文章內容 <small>Markdown</small></label>
            <span>{draft.body.length.toLocaleString("zh-TW")} / 5,000</span>
          </div>
          <div className="composer-toolbar" role="group" aria-label="Markdown 格式工具">
            {markdownTools.map(({ label, start, sample, end }) =>
              <button type="button" key={label} onClick={() => insertMarkdown(start, sample, end)}>{label}</button>)}
          </div>
          <textarea ref={editor} id="post-markdown" value={draft.body} placeholder="寫下種植環境、照顧方式與你的觀察。可使用上方工具插入 Markdown。" rows={9} maxLength={5000} onChange={(event) => { setDraft({ ...draft, body: event.target.value }); setDraftSaved(false); }} />
        </section>
        <section className="composer-surface editor-preview" aria-label="文章預覽">
          <div className="editor-panel-heading"><span>即時預覽</span></div>
          <div className="composer-preview">
            {draft.title.trim() && <h2>{draft.title}</h2>}
            {draft.body.trim()
              ? <ArticleMarkdown body={draft.body} font={draft.font} fontSize={draft.fontSize} />
              : <p>開始撰寫後，這裡會顯示發表時的排版。</p>}
          </div>
        </section>
      </div>
      <fieldset className="draft-images">
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
      {storageError && <p role="alert">{storageError}</p>}
      <div className="trial-actions">
        <button className="primary-button" type="submit" disabled={pending}>{editingId ? "儲存文章修改" : "發表文章"} <ArrowRight size={16} /></button>
        {!editingId && <button className="trial-draft-button" type="button" onClick={saveDraft}>儲存本機草稿</button>}
        {draftSaved && <p className="save-status" role="status">已儲存，下次開啟發文頁可繼續編輯。</p>}
      </div>
    </form>
  );
}
