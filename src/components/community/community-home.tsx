"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bookmark, ChevronDown, ChevronRight, Flower2, Heart, LayoutList, Leaf, List, MapPin, MessageCircle, PenLine, Plus, Search, SlidersHorizontal, Sprout, X } from "lucide-react";

import { topics } from "@/lib/community-content";
import { getRegion } from "@/lib/expert-columns";
import { forumAction, type ForumPost } from "@/lib/trial-forum-client";
import { memberAction } from "@/lib/member-client";
import { PostEditor } from "./post-editor";
import { CommunitySessionContext, type ForumUser } from "./community-session";

type Post = {id:string;title:string;excerpt:string;category:string;type:string;author:string;authorId:string;region:string;location:string;time:string;likes:number;replies:number;tags:string[];color:string;trial:ForumPost};
 type Mode = "about" | "login" | "register";
 function toPostPreview(post:ForumPost):Post {
  const regions:Record<string,string>={north:"北部",central:"中部",south:"南部",east:"東部",island:"離島",indoor:"室內",highland:"高山"};
  const types:Record<string,string>={question:"發問",share:"分享",guide:"教學"};
  const location = getRegion(post.regionCode ?? "");
  return {id:post.id,title:post.title,excerpt:post.body,category:post.category,type:types[post.postType]??"討論",author:post.author,authorId:post.authorId,
  region:regions[post.region??""]??"未指定",location:location?`${location.county} · ${location.district}`:regions[post.region??""]??"未指定",time:new Date(post.createdAt).toLocaleDateString("zh-TW"),likes:post.likeCount,replies:post.replyCount,tags:[post.category],color:"sage",trial:post};
 }

type CommunityView = "home" | "columns" | "discussions" | "article" | "write" | "expert-write";

export function CommunityHome({ view = "home", children, editId }: { view?: CommunityView; children?: ReactNode; editId?: string | null }) {
  const [topic, setTopic] = useState("全部植物");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("最新討論");
  const [region, setRegion] = useState("所有地區");
  const [compact, setCompact] = useState(true);
  const [bookmarkPending,setBookmarkPending]=useState<string|null>(null);
  const [bookmarkOwner,setBookmarkOwner]=useState<string|null>(null);
  const [saved, setSaved] = useState<Post["id"][]>([]);
  const [mode, setMode] = useState<Mode>("about");
  const [user, setUser] = useState<ForumUser | null>(null);
  const [loadingForum, setLoadingForum] = useState(true);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [pending, setPending] = useState(false);
  const [forumError, setForumError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [published, setPublished] = useState<ForumPost | null>(null);
  const editing = forumPosts.find((post) => post.id === editId);
  const [storageError, setStorageError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/forum", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (editId && !data.posts.some((post: ForumPost) => post.id === editId)) {
        const editResponse = await fetch(`/api/forum?id=${encodeURIComponent(editId)}`, { cache: "no-store" });
        const editData = await editResponse.json();
        if (editResponse.ok) data.posts.push(editData.post);
      }
      if (!active) return;
      setUser(data.user);
      setForumPosts(data.posts);
      setNextCursor(data.nextCursor);
      if (new URLSearchParams(window.location.search).has("auth_error")) setForumError("信箱驗證連結無效或已過期，請重新申請驗證或登入。");
    }).catch((error) => {
      if (active) setForumError(error.message || "無法載入會員狀態與社群文章，請重新整理。");
    }).finally(() => {
      if (active) setLoadingForum(false);
    });
    return () => { active = false; };
  }, [editId]);
  const allPosts: Post[] = forumPosts.map(toPostPreview);
  const filtered = allPosts.filter((post) =>
    (topic === "全部植物" || post.category === topic) &&
    (region === "所有地區" || post.region === region) &&
    (post.title + post.excerpt + post.tags.join(" ")).includes(query.trim()));
  if (sort === "熱門討論") filtered.sort((a, b) => b.likes - a.likes);
  if (sort === "最多回覆") filtered.sort((a, b) => b.replies - a.replies);
  const writeHref = "/discussions/write" + (topic !== "全部植物" ? "?board=" + encodeURIComponent(topic) : "");

  function open(nextMode: Mode) {
    setMode(nextMode);
    setStorageError("");
    setAuthNotice("");
    if (!dialog.current?.open) dialog.current?.showModal();
  }

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/member-data",{cache:"no-store",signal:controller.signal}).then(async response=>{
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(!controller.signal.aborted){setSaved(result.bookmarks);setBookmarkOwner(user?.id??null);}
    }).catch(error=>{if(!controller.signal.aborted)setForumError(error.message||"無法載入收藏。");});
    return ()=>controller.abort();
  },[user?.id]);
  async function toggleBookmark(id:string){
    if(!user){open("login");return;}
    const shouldSave=!saved.includes(id);setBookmarkPending(id);
    try{await memberAction("bookmark",{postId:id,saved:shouldSave});setSaved(current=>shouldSave?[...new Set([...current,id])]:current.filter(item=>item!==id));}
    catch(error){setForumError((error as Error).message);}finally{setBookmarkPending(null);}
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setStorageError("");
    setAuthNotice("");
    setPending(true);
    try {
      const result = await forumAction(mode, fields);
      setUser(result.user ?? null);
      if (result.message) { setAuthNotice(result.message); return; }
      dialog.current?.close();
    } catch (error) {
      setStorageError((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function loadMorePosts() {
    if (!nextCursor || pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/forum?cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setForumPosts((current) => [...current, ...data.posts.filter((post: ForumPost) => !current.some((item) => item.id === post.id))]);
      setNextCursor(data.nextCursor);
    } catch (error) { setForumError((error as Error).message); }
    finally { setPending(false); }
  }

  async function logout() {
    setPending(true);
    setForumError("");
    try {
      await forumAction("logout");
      setUser(null);
    } catch (error) {
      setForumError((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  function chooseTopic(value: string) {
    setTopic(value);
    document.getElementById("discussions")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <CommunitySessionContext.Provider value={{ user, loading: loadingForum, requestLogin: () => open("login") }}>
    <div className={"community view-" + view}>
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="GreenThumb 首頁"><span className="brand-mark"><Sprout size={27} strokeWidth={1.7} /></span><span>GreenThumb<span className="brand-sub">一起，把日子種好。</span></span></Link>
          <div className="header-actions">
            {user && <span className="member-name" title={user.name}>{user.role === "admin" ? "管理員" : user.name}</span>}
            <button className="quiet-button" disabled={loadingForum || pending} onClick={() => user ? logout() : open("login")}>{user ? "登出" : "登入"}</button>
            {view !== "write" && view !== "expert-write" && <Link className="primary-button" href={writeHref}><PenLine size={16} />發表文章</Link>}
          </div>
        </div>
      </header>

      <main className="page-shell" id="main-content" tabIndex={-1}>
        {forumError && <p role="alert">{forumError}</p>}
        {children}

        {view === "discussions" && (
          <section className="discussion-intro" aria-labelledby="discussion-page-title">
            <div>
              <nav className="breadcrumbs" aria-label="麵包屑"><Link href="/">首頁</Link><ChevronRight size={13} /><span>討論區</span></nav>
              <h1 id="discussion-page-title">植物討論區</h1>
              <p>找一個懂你植物的人。從觀葉、多肉到香草，交換在地照顧經驗。</p>
            </div>
            <span className="board-total"><Leaf size={17} /> {allPosts.length} 篇種植故事</span>
          </section>
        )}

        {view === "write" && (
          <section className="write-page" aria-labelledby="write-title">
            <nav className="breadcrumbs" aria-label="麵包屑"><Link href="/">首頁</Link><ChevronRight size={13} /><Link href="/discussions">討論區</Link><ChevronRight size={13} /><span>{editId ? "編輯文章" : "發表文章"}</span></nav>
            <header className="write-intro">
              <div><p className="eyebrow">和同好聊聊你的植物</p>
              <h1 id="write-title">{editId ? "編輯文章" : "發表文章"}</h1></div>
              <p>一個問題、一片新葉，都值得記錄。</p>
            </header>
            {loadingForum ? <p role="status">載入發文頁…</p>
              : published ? <div className="write-notice">
                <h2>{editId ? "文章修改已儲存" : "文章已發表"}</h2>
                <p>{published.title}</p>
                <Link className="primary-button" href={`/discussions/${published.id}`}>查看文章</Link>
                {published.regionCode && <Link className="text-link" href="/columns#expert-map"><MapPin size={15} />到地圖看看文章圖釘</Link>}
              </div>
              : editId && !user ? <div className="write-notice"><p>登入後可編輯自己的文章。</p><button className="primary-button" onClick={() => open("login")}>登入或註冊</button></div>
              : editId && (!editing || (user?.role === "member" && editing.authorId !== user?.id))
                ? <p role="alert">找不到文章，或你沒有編輯權限。</p>
                : <PostEditor key={editId ?? "new"} post={editing} canPublish={Boolean(user)} onRequireLogin={() => open("login")} onPublished={(post, warning) => {
                  setPublished(post);
                  if (warning) setForumError(warning);
                }} />}
          </section>
        )}

        {(view === "home" || view === "discussions") && (
        <div className="content-grid forum-grid">
          <aside className="board-navigation" aria-label="看板導覽">
            <div className="board-navigation-title"><Sprout size={18} /><h2>植物看板</h2></div>
            {topics.map((value, index) => <button key={value} className={topic === value ? "active" : ""} aria-pressed={topic === value} onClick={() => chooseTopic(value)}><span>{index === 0 ? <LayoutList size={16} /> : index === 2 ? <Sprout size={16} /> : index === 4 ? <Flower2 size={16} /> : <Leaf size={16} />}{value === "全部植物" ? "全部討論" : value}</span><small>{index === 0 ? allPosts.length : allPosts.filter((post) => post.category === value).length}</small></button>)}
            <div className="board-navigation-note"><span>每個問題，都有生長的可能。</span><p>分享環境和照顧方式，讓同好更容易幫上忙。</p><Link href={writeHref}>寫下我的第一篇 <ArrowUpRight size={14} /></Link></div>
          </aside>
          <section id="discussions" className={"discussions forum-feed" + (compact ? " feed-compact" : "")} aria-labelledby="discussion-title">
            <div className="section-heading"><div><p className="eyebrow">PLANT PEOPLE, PLANT STORIES</p><h2 id="discussion-title">{topic === "全部植物" ? view === "home" ? "植物討論區" : "全部討論" : topic}<span className="heading-dot">.</span></h2></div><Link className="primary-button" href={writeHref}><PenLine size={15} />發表文章</Link></div>
            <div className="search-field"><Search size={19} /><input aria-label="搜尋討論" placeholder="找植物、找問題，或一點種植靈感…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="清除搜尋" onClick={() => setQuery("")}><X size={16} /></button>}<span className="search-hint">探索你的綠世界</span></div>
            <div className="topic-tabs mobile-board-tabs" aria-label="植物分類">{topics.map((value) => <button key={value} aria-pressed={topic === value} className={topic === value ? "active" : ""} onClick={() => setTopic(value)}>{value}</button>)}</div>
            <div className="feed-toolbar"><div className="sort-tabs">{["最新討論", "熱門討論", "最多回覆"].map((value) => <button key={value} className={sort === value ? "active" : ""} aria-pressed={sort === value} onClick={() => setSort(value)}>{value}</button>)}</div><label className="region-filter"><SlidersHorizontal size={14} /><select aria-label="依地區篩選" value={region} onChange={(event) => setRegion(event.target.value)}>{["所有地區", "北部", "中部", "南部", "東部", "離島"].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={13} /></label></div>
            <div className="feed-summary"><span>共 {filtered.length} 篇討論{query.trim() && ` · 搜尋「${query.trim()}」`}</span><div role="group" aria-label="列表顯示方式"><button aria-label="精簡列表" aria-pressed={compact} onClick={() => setCompact(true)}><List size={16} /></button><button aria-label="摘要列表" aria-pressed={!compact} onClick={() => setCompact(false)}><LayoutList size={16} /></button></div></div>
            <div className="post-list" aria-live="polite">
              {filtered.map((post) => <article className="post" key={post.id}>
                <div className={"plant-tile " + post.color} aria-hidden="true">{post.category === "花卉植物" ? <Flower2 /> : post.category === "多肉植物" ? <Sprout /> : <Leaf />}<span>{post.category.slice(0, 2)}</span></div>
                <div className="post-body"><div className="post-meta"><span className={"post-type type-" + post.type}>{post.type}</span><span>{post.author}</span><span className="meta-dot">·</span><span>{post.time}</span></div><Link className="post-title" href={`/discussions/${post.id}`}>{post.title}</Link><p>{post.excerpt}</p><div className="post-bottom"><div className="tags">{post.tags.map((tag) => <button key={tag} onClick={() => setQuery(tag)}>#{tag}</button>)}<span className="post-location"><MapPin size={11} />{post.location}</span></div><div className="post-stats"><span><Heart size={14} />{post.likes}</span><Link href={`/discussions/${post.id}#article-responses`} aria-label={`閱讀 ${post.replies} 則回應`}><MessageCircle size={14} />{post.replies}</Link><button aria-label={(saved.includes(post.id) ? "取消收藏：" : "收藏：") + post.title} aria-pressed={saved.includes(post.id)} className={saved.includes(post.id) ? "is-saved" : ""} disabled={bookmarkPending!==null || (!!user && bookmarkOwner!==user.id)} onClick={() => toggleBookmark(post.id)}><Bookmark size={15} fill={saved.includes(post.id) ? "currentColor" : "none"} /></button></div></div></div>
              </article>)}
              {filtered.length === 0 && <div className="empty-state"><Sprout size={35} /><h3>這片小花園還在等待新故事</h3><p>試試其他關鍵字，或切換植物分類與地區。</p><button className="text-link" onClick={() => { setQuery(""); setTopic("全部植物"); setRegion("所有地區"); }}>清除篩選 <ArrowRight size={15} /></button></div>}
            </div>
            {nextCursor && <button className="text-link" disabled={pending} onClick={loadMorePosts}>{pending ? "載入中…" : "載入更多討論"}</button>}
            <p className="feed-end"><span /> 每一份分享，都是讓知識生長的養分 <Leaf size={13} /><span /></p>
          </section>

          <aside className="sidebar">
            <section className="community-welcome"><span className="welcome-icon"><Sprout size={25} strokeWidth={1.4} /></span><h3>{user ? `${user.name}，今天種得好嗎？` : "歡迎來到綠手指的日常"}</h3><p>有新發現，或遇到照顧難題？<br />這裡有和你一樣喜歡植物的人。</p><Link className="primary-button" href={writeHref}><Plus size={15} /> 開始一篇討論</Link>{!user && <button className="text-link" onClick={() => open("login")}>登入／加入社群 <ArrowRight size={14} /></button>}</section>
            <section id="plants" className="plant-directory"><div className="aside-heading"><h3>找到你的植物</h3><span>PLANT CLUBS</span></div><p>從一片葉子，找到同樣著迷的人。</p>{[{name:"觀葉植物",en:"FOLIAGE",icon:Leaf,color:"sage",desc:"把森林的一角，搬進家裡"},{name:"多肉植物",en:"SUCCULENTS",icon:Sprout,color:"rose",desc:"小小一盆，收藏可愛的日常"},{name:"香草植物",en:"HERBS",icon:Flower2,color:"sand",desc:"從陽台到餐桌的一點清香"}].map(({name,en,icon:Icon,color,desc}) => <button className="plant-club" key={name} onClick={() => chooseTopic(name)}><span className={"club-icon " + color}><Icon size={24} strokeWidth={1.4} /></span><span><small>{en}</small><strong>{name}</strong><em>{desc}</em></span><ArrowUpRight size={17} /></button>)}<button className="text-link directory-link" onClick={() => chooseTopic("全部植物")}>探索所有植物 <ArrowRight size={15} /></button></section>
            <div className="community-promise"><span><Heart size={17} /></span><p>在這裡，沒有太基本的問題。<small>友善交流，尊重每一種種植方式。</small></p></div>
          </aside>
        </div>
        )}

        {view !== "write" && view !== "expert-write" && <section className="join-banner"><div className="join-icon"><Sprout size={37} strokeWidth={1.3} /></div><div><p className="eyebrow">GROW SOMETHING GOOD</p><h2>你的種植小事，也可能是別人的靈感。</h2><p>一個問題、一張新葉、一段照顧心得。歡迎從這裡開始。</p></div><Link className="primary-button" href="/discussions/write">分享我的綠日常 <Plus size={17} /></Link></section>}
      </main>
      <footer className="site-footer"><Link className="footer-brand" href="/"><Sprout size={21} /> GreenThumb</Link><button className="quiet-button" onClick={() => open("about")}>關於社群</button><span>© 2026 GreenThumb <span className="footer-separator">/</span> Made for plant people.</span></footer>

      <dialog ref={dialog} className="community-dialog" aria-labelledby="dialog-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}><button className="dialog-close" aria-label="關閉視窗" onClick={() => dialog.current?.close()}><X size={20} /></button>
        {mode === "login" || mode === "register" ? (
          <>
            <h2 id="dialog-title">{mode === "register" ? "註冊帳號" : "登入 GreenThumb"}</h2>

            <form key={mode} onSubmit={submitAuth}>
              {mode === "register" && <label>暱稱<input name="name" autoComplete="nickname" required maxLength={40} /></label>}
              <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
              <label>密碼<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} /></label>
              {mode === "register" && <p className="dialog-footnote">密碼至少 12 字元，註冊後請到信箱完成驗證。</p>}
              {authNotice && <p role="status">{authNotice}</p>}
              {storageError && <p role="alert">{storageError}</p>}
              <div className="trial-actions">
                <button className="primary-button" disabled={pending}>{mode === "register" ? "註冊帳號" : "登入"}</button>
                <button className="trial-draft-button" type="button" disabled={pending} onClick={() => open(mode === "register" ? "login" : "register")}>
                  {mode === "register" ? "已有帳號？登入" : "建立帳號"}
                </button>
              </div>
            </form>
          </>
        ) : <><p className="eyebrow">HELLO, PLANT PEOPLE</p><h2 id="dialog-title">喜歡植物，就有聊不完的事。</h2><p>GreenThumb 想把散落的種植經驗，慢慢累積成人人都能查找的知識。無論你剛帶回第一盆植物，或已經照顧了一整座陽台，都歡迎來交換心得。</p><div className="article-note"><Heart size={22} /><p>分享實際環境與觀察、友善提問，並尊重不同經驗。每一個認真照顧植物的人，都值得被好好回應。</p></div></>}
      </dialog>
    </div>
    </CommunitySessionContext.Provider>
  );
}
