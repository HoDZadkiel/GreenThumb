"use client";

import { useEffect, useState } from "react";
import { List, MessageCircle } from "lucide-react";

export function ArticleOutline({ contentId, responsesId }: { contentId: string; responsesId: string }) {
  const [headings,setHeadings] = useState<{id:string;text:string;level:number}[]>([]);
  const [active,setActive] = useState(contentId);
  useEffect(() => {
    const content = document.getElementById(contentId);
    const nodes = Array.from(content?.querySelectorAll<HTMLElement>(".article-markdown > h2, .article-markdown > h3") ?? []);
    nodes.forEach((node,index) => { node.id = `${contentId}-section-${index+1}`; });
    const frame = requestAnimationFrame(() => setHeadings(nodes.map(node => ({id:node.id,text:node.textContent ?? "",level:Number(node.tagName.slice(1))}))));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible[0]) setActive(visible[0].target.id);
    },{rootMargin:"-8% 0px -65% 0px"});
    for(const node of nodes) observer.observe(node);
    return () => {cancelAnimationFrame(frame);observer.disconnect();};
  },[contentId]);
  return <nav className="reading-outline" aria-label="本文導覽">
    <p className="reading-rail-label"><List size={14}/>本文導覽</p>
    <a href={`#${contentId}`} onClick={()=>setActive(contentId)} aria-current={active===contentId?"location":undefined}>從這裡開始</a>
    {headings.map(heading=><a key={heading.id} href={`#${heading.id}`} className={heading.level===3?"reading-subheading":undefined} aria-current={active===heading.id?"location":undefined} onClick={()=>setActive(heading.id)}>{heading.text}</a>)}
    <a className="reading-replies-link" href={`#${responsesId}`} onClick={()=>setActive(responsesId)} aria-current={active===responsesId?"location":undefined}><MessageCircle size={14}/>讀者回應</a>
  </nav>;
}
