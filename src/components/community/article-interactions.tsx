"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Heart, MessageCircle, Send, Share2 } from "lucide-react";
import type { ArticleInteractions as InteractionData, ArticleKind, ArticleReply } from "@/lib/article-interactions";
import { useCommunitySession } from "./community-session";

async function readResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "暫時無法完成操作，請稍後再試。");
  return result;
}

type Props = { kind: ArticleKind; id: string; title: string; path: string };

export function ArticleInteractions(props: Props) {
  return <ArticleInteractionPanel key={`${props.kind}:${props.id}`} {...props} />;
}

function ArticleInteractionPanel({ kind, id, title, path }: Props) {
  const { user, loading, requestLogin } = useCommunitySession();
  const sectionId = useId();
  const [data, setData] = useState<(InteractionData & { ownerId: string | null }) | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [refresh, setRefresh] = useState(0);
  const query = new URLSearchParams({ kind, id }).toString();
  const ownerId = user?.id ?? null;
  const ready = !loading && data !== null && data.ownerId === ownerId;

  useEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    fetch(`/api/article-interactions?${query}`, { cache: "no-store", signal: controller.signal })
      .then(readResponse)
      .then((result: InteractionData) => { setData({ ...result, ownerId }); setError(""); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message || "無法載入文章回應。"); });
    return () => controller.abort();
  }, [query, ownerId, loading, refresh]);

  async function action(fields: object) {
    return readResponse(await fetch("/api/article-interactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, ...fields }),
    }));
  }

  async function toggleLike() {
    if (!user) { requestLogin(); return; }
    if (!ready || pending) return;
    setPending(true); setError("");
    try {
      const result = await action({ action: "like", liked: !data!.liked });
      setData(current => current?.ownerId === ownerId ? { ...current, liked: result.liked, likeCount: result.likeCount } : current);
    } catch (failure) { setError((failure as Error).message || "按讚失敗，請稍後再試。"); }
    finally { setPending(false); }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { requestLogin(); return; }
    if (!ready || pending) return;
    setPending(true); setError(""); setNotice("");
    try {
      const { reply }: { reply: ArticleReply } = await action({ action: "reply", body });
      setData(current => current?.ownerId === ownerId ? { ...current, replyCount: current.replyCount + 1, replies: [...current.replies, reply] } : current);
      setBody(""); setNotice("回應已送出，謝謝你的分享。");
    } catch (failure) { setError((failure as Error).message || "回應未送出，請稍後再試。"); }
    finally { setPending(false); }
  }

  async function loadMore() {
    if (!data?.nextCursor || pending) return;
    setPending(true); setError("");
    try {
      const result: InteractionData = await readResponse(await fetch(`/api/article-interactions?${query}&cursor=${data.nextCursor}`, { cache: "no-store" }));
      setData(current => current && {
        ...current, ...result,
        replies: [...current.replies, ...result.replies.filter(reply => !current.replies.some(item => item.id === reply.id))]
          .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1),
      });
    } catch (failure) { setError((failure as Error).message || "無法載入更多回應。"); }
    finally { setPending(false); }
  }

  async function share() {
    setSharing(true); setNotice("");
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("文章連結已複製，可以分享給朋友了。");
      } else { setShareLink(url); }
    } catch { setShareLink(url); }
    finally { setSharing(false); }
  }

  return <section id="article-responses" className="article-interactions" aria-labelledby={`${sectionId}-heading`}>
    <div className="article-social-actions">
      <button type="button" className={ready && data!.liked ? "is-liked" : ""} aria-pressed={ready && data!.liked} disabled={loading || pending || !ready} onClick={toggleLike}>
        <Heart size={18} fill={ready && data!.liked ? "currentColor" : "none"} />{ready && data!.liked ? "已按讚" : "按讚"}<span>{ready ? data!.likeCount : "—"}</span>
      </button>
      <a href={`#${sectionId}-replies`}><MessageCircle size={18} />回應<span>{ready ? data!.replyCount : "—"}</span></a>
      <button type="button" onClick={share} disabled={sharing}><Share2 size={18} />分享文章</button>
    </div>
    {notice && <p className="article-interaction-notice" role="status">{notice}</p>}
    {shareLink && <label className="article-share-link">複製這個連結分享<input aria-label={`${title}的分享連結`} readOnly value={shareLink} onFocus={event => event.currentTarget.select()} /></label>}
    {error && <div className="article-interaction-error" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setRefresh(value => value + 1)}>重新載入回應</button></div>}
    <div id={`${sectionId}-replies`} className="article-replies-heading"><p className="eyebrow">KEEP THE CONVERSATION GROWING</p><h2 id={`${sectionId}-heading`}>一起聊聊這篇文章<span className="heading-dot">.</span></h2><p>你的觀察與經驗，也能讓另一個人的植物長得更好。</p></div>
    {!ready && !error && <p role="status">載入按讚與回應…</p>}
    {ready && <>
      <ol className="article-replies" aria-label="讀者回應">
        {data!.replies.map(reply => <li key={reply.id}>
          <div className="article-reply-meta"><strong>{reply.author}</strong><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
          <p>{reply.body}</p>
        </li>)}
      </ol>
      {data!.replyCount === 0 && <p className="article-replies-empty">還沒有回應，來分享你的第一個想法吧。</p>}
      {data!.nextCursor && <button className="text-link" type="button" disabled={pending} onClick={loadMore}>載入更多回應</button>}
      {data!.canReply ? <form className="article-reply-form" onSubmit={submitReply}>
        <label htmlFor={`${sectionId}-body`}>{user ? `${user.name}，寫下你的回應` : "留下你的種植觀察"}<span>{body.length} / 2000</span></label>
        <textarea id={`${sectionId}-body`} value={body} onChange={event => setBody(event.target.value)} rows={4} required maxLength={2000} placeholder="分享經驗、提出問題，或向作者說聲謝謝…" />
        <div><p>{user ? "友善交流，尊重每一種種植方式。" : "登入後即可按讚與送出回應。"}</p>{user
          ? <button className="primary-button" disabled={pending || !body.trim()}><Send size={15} />{pending ? "處理中…" : "送出回應"}</button>
          : <button className="primary-button" type="button" onClick={requestLogin}>登入參與回應</button>}</div>
      </form> : <p className="article-replies-empty">這篇文章已鎖定，暫時無法新增回應。</p>}
    </>}
  </section>;
}
