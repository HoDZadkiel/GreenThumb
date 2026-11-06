import Image from "next/image";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { isImgBBImage } from "@/lib/community-content";
import type { ArticleFont, ArticleFontSize } from "@/lib/trial-posts";

export function ArticleMarkdown({ body, font, fontSize = 16 }: { body: string; font: ArticleFont; fontSize?: ArticleFontSize }) {
  return (
    <div className="article-markdown" data-font={font} data-font-size={fontSize}>
      <Markdown skipHtml remarkPlugins={[remarkGfm]}
        urlTransform={(url, key) => key === "src"
          ? (url.length <= 2048 && isImgBBImage(url) ? url : "")
          : defaultUrlTransform(url)}
        components={{
          img: ({ src, alt }) => src && typeof src === "string"
            ? <Image src={src} alt={alt ?? ""} width={760} height={480} unoptimized referrerPolicy="no-referrer" />
            : <span>［圖片需使用 ImgBB 直接連結］</span>,
        }}
      >{body}</Markdown>
    </div>
  );
}
