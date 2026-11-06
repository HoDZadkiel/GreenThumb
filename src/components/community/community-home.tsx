"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, ChevronDown, Flower2, Heart, Leaf, MapPin, MessageCircle, Plus, Search, SlidersHorizontal, Sprout, Sun, X } from "lucide-react";

import { posts, topics } from "@/lib/community-content";
import { getTrialPostsSnapshot, readTrialPosts, subscribeToTrialPosts } from "@/lib/trial-posts";
import type { TrialPost } from "@/lib/trial-posts";
import { forumAction, type ForumPost } from "@/lib/trial-forum-client";
import { PostEditor } from "./post-editor";
import { ArticleMarkdown } from "./article-markdown";

type ForumUser = { id: string; name: string; role: "member" | "admin" };
type Post = Omit<(typeof posts)[number], "id"> & { id: number | string; trial?: TrialPost; authorId?: string };
type Mode = "post" | "about" | "login" | "register";
function toTrialPreview(post: TrialPost, memberPost?: ForumPost): Post {
  return {
    id: post.id, title: post.title, excerpt: post.body, category: post.category,
    type: "試用", author: memberPost?.author ?? "你", authorId: memberPost?.authorId,
    region: "未指定", time: memberPost ? "社群文章" : "舊版本機文章",
    likes: 0, replies: 0, tags: [post.category], color: "sage", answer: "", trial: post,
  };
}

type CommunityView = "home" | "columns" | "discussions" | "write";

const navigation = [
  { view: "home", href: "/", label: "首頁" },
  { view: "columns", href: "/columns", label: "專欄" },
  { view: "discussions", href: "/discussions", label: "討論區" },
] as const;

export function CommunityHome({ view = "home", children, editId }: { view?: CommunityView; children?: ReactNode; editId?: string | null }) {
  const [topic, setTopic] = useState("全部植物");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("最新討論");
  const [region, setRegion] = useState("所有地區");
  const [saved, setSaved] = useState<Post["id"][]>([]);
  const [selected, setSelected] = useState<Post | null>(null);
  const [mode, setMode] = useState<Mode>("about");
  const [user, setUser] = useState<ForumUser | null>(null);
  const [loadingForum, setLoadingForum] = useState(true);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [pending, setPending] = useState(false);
  const [forumError, setForumError] = useState("");
  const [published, setPublished] = useState<ForumPost | null>(null);
  const editing = forumPosts.find((post) => post.id === editId);
  const [storageError, setStorageError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trialPosts = readTrialPosts(useSyncExternalStore(subscribeToTrialPosts, getTrialPostsSnapshot, () => null));
  useEffect(() => {
    let active = true;
    fetch("/api/trial-forum").then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!active) return;
      setUser(data.user);
      setForumPosts(data.posts);
    }).catch(() => {
      if (active) setForumError("無法載入會員狀態與社群文章，請重新整理。");
    }).finally(() => {
      if (active) setLoadingForum(false);
    });
    return () => { active = false; };
  }, []);
  const allPosts: Post[] = [
    ...forumPosts.map((post) => toTrialPreview(post, post)),
    ...trialPosts.map((post) => toTrialPreview(post)),
    ...posts,
  ];
  const filtered = allPosts.filter((post) =>
    (topic === "全部植物" || post.category === topic) &&
    (region === "所有地區" || post.region === region) &&
    (post.title + post.excerpt + post.tags.join(" ")).includes(query.trim()));
  if (sort === "熱門討論") filtered.sort((a, b) => b.likes - a.likes);

  function open(nextMode: Mode, post?: Post) {
    setMode(nextMode);
    setSelected(post ?? null);
    setStorageError("");
    if (!dialog.current?.open) dialog.current?.showModal();
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setStorageError("");
    setPending(true);
    try {
      const result = await forumAction(mode, fields);
      setUser(result.user);
      dialog.current?.close();
    } catch (error) {
      setStorageError((error as Error).message);
    } finally {
      setPending(false);
    }
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
    <div className="community">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="GreenThumb 首頁"><span className="brand-mark"><Sprout size={27} strokeWidth={1.7} /></span><span>GreenThumb<span className="brand-sub">一起，把日子種好。</span></span></Link>
          <nav aria-label="主要導覽">
            {navigation.map((item) => (
              <Link key={item.view} href={item.href} className={view === item.view ? "nav-active" : undefined} aria-current={view === item.view ? "page" : undefined}>{item.label}</Link>
            ))}
          </nav>
          <div className="header-actions">
            {user && <span className="member-name" title={user.name}>{user.role === "admin" ? "管理員" : user.name}</span>}
            <button className="quiet-button" disabled={loadingForum || pending} onClick={() => user ? logout() : open("login")}>{user ? "登出" : "登入"}</button>
            {view !== "write" && <Link className="primary-button" href="/discussions/write"><Plus size={17} />發起討論</Link>}
          </div>
        </div>
      </header>

      <main className="page-shell" id="main-content" tabIndex={-1}>
        {forumError && <p role="alert">{forumError}</p>}
        {view === "home" && <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> A LITTLE GREENER, TOGETHER</p>
            <h1 id="hero-title">每一片新葉，<br />都有值得分享的<span>故事。</span></h1>
            <p className="hero-description">從第一盆植物，到一整座陽台。<br />在這裡交換種植心得，讓喜歡的事，一起慢慢長大。</p>
            <Link className="primary-button hero-button" href="/discussions">找到你的綠色同好 <ArrowUpRight size={18} /></Link>
            <div className="hero-note"><span className="avatar-stack" aria-hidden="true"><i>葉</i><i>森</i><i>花</i><i><Leaf size={15} /></i></span><span>不同的生活，同樣喜歡植物。<small>給每一雙綠手指的交流空間</small></span></div>
          </div>
          <div className="hero-visual"><Image src="/images/plant-studio.png" alt="晨光灑落在陶盆龜背芋與蕨類植物上" fill priority sizes="(max-width: 760px) 100vw, 50vw" /><div className="photo-caption"><span className="caption-icon"><Leaf size={20} /></span><div><small>把綠意，帶進日常</small><span>一盆植物，就是一個開始。</span></div><span className="photo-number">GROW / 01</span></div></div>
        </section>

        <div className="community-values"><span><Sprout size={18} />新手也能安心發問</span><span><MessageCircle size={18} />讓經驗成為彼此的養分</span><span><MapPin size={18} />在地氣候，在地種植經驗</span><a href="#discussions">一起向綠生活靠近 <ArrowDown size={15} /></a></div>
        </>}

        {view === "discussions" && (
          <section className="discussion-intro" aria-labelledby="discussion-page-title">
            <div>
              <p className="eyebrow">THE GROWING ROOM</p>
              <h1 id="discussion-page-title">植物討論區</h1>
              <p>找一個懂你植物的人。從觀葉、多肉到香草，交換在地照顧經驗。</p>
            </div>
            <Link className="primary-button" href="/discussions/write"><Plus size={17} /> 發起討論</Link>
          </section>
        )}

        {view === "write" && (
          <section className="write-page" aria-labelledby="write-title">
            <Link className="text-link" href="/discussions">← 返回討論區</Link>
            <header className="write-intro">
              <p className="eyebrow">GREEN THUMB WRITING ROOM</p>
              <h1 id="write-title">{editId ? "編輯文章" : "發起討論"}</h1>
              <p>記下種植經驗、分享照片，或向同好請教。</p>
            </header>
            {loadingForum ? <p role="status">載入發文頁…</p>
              : published ? <div className="write-notice">
                <h2>{editId ? "文章修改已儲存" : "文章已發表"}</h2>
                <p>{published.title}</p>
                <button className="primary-button" onClick={() => open("post", toTrialPreview(published, published))}>查看文章</button>
              </div>
              : !user ? <div className="write-notice">
                <p>登入後即可發文。</p>
                <button className="primary-button" onClick={() => open("login")}>登入或註冊</button>
              </div>
              : editId && (!editing || (user.role !== "admin" && editing.authorId !== user.id))
                ? <p role="alert">找不到文章，或你沒有編輯權限。</p>
                : <PostEditor key={editId ?? "new"} post={editing} onPublished={(post, warning) => {
                  setPublished(post);
                  if (warning) setForumError(warning);
                }} />}
          </section>
        )}

        {children}

        {(view === "home" || view === "discussions") && (
        <div className="content-grid">
          <section id="discussions" className="discussions" aria-labelledby="discussion-title">
            <div className="section-heading"><div><p className="eyebrow">THE COMMUNITY</p><h2 id="discussion-title">{view === "home" ? "綠意正在發生" : "瀏覽討論"}<span className="heading-dot">.</span></h2></div><span className="sample-label">網頁試用</span></div>
            <div className="search-field"><Search size={19} /><input aria-label="搜尋討論" placeholder="找植物、找問題，或一點種植靈感…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="清除搜尋" onClick={() => setQuery("")}><X size={16} /></button>}<span className="search-hint">探索你的綠世界</span></div>
            <div className="topic-tabs" aria-label="植物分類">{topics.map((value) => <button key={value} aria-pressed={topic === value} className={topic === value ? "active" : ""} onClick={() => setTopic(value)}>{value === "全部植物" && <Leaf size={15} />}{value}</button>)}</div>
            <div className="feed-toolbar"><div className="sort-tabs">{["最新討論", "熱門討論"].map((value) => <button key={value} className={sort === value ? "active" : ""} aria-pressed={sort === value} onClick={() => setSort(value)}>{value}</button>)}</div><label className="region-filter"><SlidersHorizontal size={14} /><select aria-label="依地區篩選" value={region} onChange={(event) => setRegion(event.target.value)}>{["所有地區", "北部", "中部", "南部", "東部", "離島"].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={13} /></label></div>
            <div className="post-list" aria-live="polite">
              {filtered.map((post) => <article className="post" key={post.id}>
                <div className={"plant-tile " + post.color} aria-hidden="true">{post.category === "花卉植物" ? <Flower2 /> : post.category === "多肉植物" ? <Sprout /> : <Leaf />}<span>{post.category.slice(0, 2)}</span></div>
                <div className="post-body"><div className="post-meta"><span className={"post-type type-" + post.type}>{post.type}</span><span>{post.author}</span><span className="meta-dot">·</span><span>{post.time}</span></div><button className="post-title" onClick={() => open("post", post)}>{post.title}</button><p>{post.excerpt}</p><div className="post-bottom"><div className="tags">{post.tags.map((tag) => <button key={tag} onClick={() => setQuery(tag)}>#{tag}</button>)}<span className="post-location"><MapPin size={11} />{post.region}</span></div><div className="post-stats"><span><Heart size={14} />{post.likes}</span><span><MessageCircle size={14} />{post.replies}</span><button aria-label={(saved.includes(post.id) ? "取消收藏：" : "收藏：") + post.title} aria-pressed={saved.includes(post.id)} className={saved.includes(post.id) ? "is-saved" : ""} onClick={() => setSaved(saved.includes(post.id) ? saved.filter((id) => id !== post.id) : [...saved, post.id])}><Bookmark size={15} fill={saved.includes(post.id) ? "currentColor" : "none"} /></button></div></div></div>
              </article>)}
              {filtered.length === 0 && <div className="empty-state"><Sprout size={35} /><h3>這片小花園還在等待新故事</h3><p>試試其他關鍵字，或切換植物分類與地區。</p><button className="text-link" onClick={() => { setQuery(""); setTopic("全部植物"); setRegion("所有地區"); }}>清除篩選 <ArrowRight size={15} /></button></div>}
            </div>
            <p className="feed-end"><span /> 每一份分享，都是讓知識生長的養分 <Leaf size={13} /><span /></p>
          </section>

          <aside className="sidebar">
            <section id="plants" className="plant-directory"><div className="aside-heading"><h3>找到你的植物</h3><span>PLANT CLUBS</span></div><p>從一片葉子，找到同樣著迷的人。</p>{[{name:"觀葉植物",en:"FOLIAGE",icon:Leaf,color:"sage",desc:"把森林的一角，搬進家裡"},{name:"多肉植物",en:"SUCCULENTS",icon:Sprout,color:"rose",desc:"小小一盆，收藏可愛的日常"},{name:"香草植物",en:"HERBS",icon:Flower2,color:"sand",desc:"從陽台到餐桌的一點清香"}].map(({name,en,icon:Icon,color,desc}) => <button className="plant-club" key={name} onClick={() => chooseTopic(name)}><span className={"club-icon " + color}><Icon size={24} strokeWidth={1.4} /></span><span><small>{en}</small><strong>{name}</strong><em>{desc}</em></span><ArrowUpRight size={17} /></button>)}<button className="text-link directory-link" onClick={() => chooseTopic("全部植物")}>探索所有植物 <ArrowRight size={15} /></button></section>
            <section id="season" className="season-card"><div className="season-top"><span><Sun size={15} /> 十一月・照護筆記</span><span>VOL. 01</span></div><Leaf className="season-leaf" size={115} strokeWidth={0.6} aria-hidden="true" /><h3>天氣轉涼，<br />也給植物一點慢節奏。</h3><p>隨著日照與溫度改變，觀察盆土乾濕，重新找到適合的澆水步調。</p><button onClick={() => { setQuery("澆水"); chooseTopic("全部植物"); }} className="season-link">一起交換換季心得 <ArrowUpRight size={16} /></button></section>
            <div className="community-promise"><span><Heart size={17} /></span><p>在這裡，沒有太基本的問題。<small>友善交流，尊重每一種種植方式。</small></p></div>
          </aside>
        </div>
        )}

        {view !== "write" && <section className="join-banner"><div className="join-icon"><Sprout size={37} strokeWidth={1.3} /></div><div><p className="eyebrow">GROW SOMETHING GOOD</p><h2>你的種植小事，也可能是別人的靈感。</h2><p>一個問題、一張新葉、一段照顧心得。歡迎從這裡開始。</p></div><Link className="primary-button" href="/discussions/write">分享我的綠日常 <Plus size={17} /></Link></section>}
      </main>
      <footer className="site-footer"><Link className="footer-brand" href="/"><Sprout size={21} /> GreenThumb</Link><button className="quiet-button" onClick={() => open("about")}>關於社群</button><span>© 2026 GreenThumb <span className="footer-separator">/</span> Made for plant people.</span></footer>

      <dialog ref={dialog} className="community-dialog" aria-labelledby="dialog-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}><button className="dialog-close" aria-label="關閉視窗" onClick={() => dialog.current?.close()}><X size={20} /></button>
        {mode === "post" && selected ? (
          <>
            <p className="eyebrow">{selected.category} / {selected.type}</p>
            <h2 id="dialog-title">{selected.title}</h2>
            <p className="dialog-meta">{selected.trial ? selected.author + " · " + selected.time : selected.author + " · " + selected.region + " · 示範文章"}</p>
            {selected.trial?.font
              ? <ArticleMarkdown body={selected.trial.body} font={selected.trial.font} fontSize={selected.trial.fontSize} />
              : <p className="trial-post-body">{selected.excerpt}</p>}
            {selected.trial ? (
              <>
                {selected.trial.images.length > 0 && (
                  <ul className="trial-post-photos">
                    {selected.trial.images.map((url, index) => (
                      <li key={url}><Image src={url} alt={"植物照片 " + (index + 1)} width={148} height={110} unoptimized referrerPolicy="no-referrer" /></li>
                    ))}
                  </ul>
                )}
                {storageError && <p role="alert">{storageError}</p>}
                {view !== "write" && selected.authorId && user && (user.role === "admin" || user.id === selected.authorId) &&
                  <Link className="primary-button trial-edit" href={`/discussions/write?edit=${encodeURIComponent(selected.id)}`}>編輯文章</Link>}
              </>
            ) : (
              <>
                <div className="article-note"><Sprout size={21} /><p>{selected.answer}</p></div>
                <p className="dialog-footnote">此為閱讀介面示範。</p>
              </>
            )}
          </>
        ) : mode === "login" || mode === "register" ? (
          <>
            <h2 id="dialog-title">{mode === "register" ? "註冊帳號" : "登入 GreenThumb"}</h2>

            <form key={mode} onSubmit={submitAuth}>
              {mode === "register" && <label>暱稱<input name="name" autoComplete="nickname" required maxLength={40} /></label>}
              <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
              <label>密碼<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} /></label>
              {mode === "register" && <p className="dialog-footnote">密碼至少 12 字元。</p>}
              {storageError && <p role="alert">{storageError}</p>}
              <div className="trial-actions">
                <button className="primary-button" disabled={pending}>{mode === "register" ? "註冊並登入" : "登入"}</button>
                <button className="trial-draft-button" type="button" disabled={pending} onClick={() => open(mode === "register" ? "login" : "register")}>
                  {mode === "register" ? "已有帳號？登入" : "建立帳號"}
                </button>
              </div>
            </form>
          </>
        ) : <><p className="eyebrow">HELLO, PLANT PEOPLE</p><h2 id="dialog-title">喜歡植物，就有聊不完的事。</h2><p>GreenThumb 想把散落的種植經驗，慢慢累積成人人都能查找的知識。無論你剛帶回第一盆植物，或已經照顧了一整座陽台，都歡迎來交換心得。</p><div className="article-note"><Heart size={22} /><p>分享實際環境與觀察、友善提問，並尊重不同經驗。每一個認真照顧植物的人，都值得被好好回應。</p></div></>}
      </dialog>
    </div>
  );
}
