import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-tc";
import "@fontsource-variable/noto-serif-tc";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenThumb — 植物種植技巧論壇",
  description:
    "討論各種植物種植技巧的論壇：觀葉、多肉、香草⋯⋯分享經驗、解決問題、累積知識。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
