"use client";

import { useEffect, useState } from "react";
import { List, MessageCircle } from "lucide-react";

export function ArticleOutline({ articleKey }: { articleKey: string }) {
  const [headings,setHeadings] = useState<{id:string;text:string;level:number}[]>([]);
  const [active,setActive] = useState("reading-content");
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reading-main .article-markdown > h2, .reading-main .article-markdown > h3"));
    nodes.forEach((node,index) => { node.id = `reading-section-${index+1}`; });
    const frame = requestAnimationFrame(() => setHeadings(nodes.map(node => ({id:node.id,text:node.textContent ?? "",level:Number(node.tagName.slice(1))}))));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible[0]) setActive(visible[0].target.id);
    },{rootMargin:"-8% 0px -65% 0px"});
    for(const node of nodes) observer.observe(node);
    return () => {cancelAnimationFrame(frame);observer.disconnect();};
  },[articleKey]);
  return <nav className="reading-outline" aria-label="本文導覽">
    <p className="reading-rail-label"><List size={14}/>本文導覽</p>
    <a href="#reading-content" onClick={()=>setActive("reading-content")} aria-current={active==="reading-content"?"location":undefined}>從這裡開始</a>
    {headings.map(heading=><a key={heading.id} href={`#${heading.id}`} className={heading.level===3?"reading-subheading":undefined} aria-current={active===heading.id?"location":undefined} onClick={()=>setActive(heading.id)}>{heading.text}</a>)}
    <a className="reading-replies-link" href="#article-responses" onClick={()=>setActive("article-responses")} aria-current={active==="article-responses"?"location":undefined}><MessageCircle size={14}/>讀者回應</a>
  </nav>;
}
