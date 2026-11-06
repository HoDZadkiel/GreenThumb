import type { Metadata } from "next";
import { Suspense } from "react";
import { WriteDiscussion } from "@/components/community/write-discussion";

export const metadata: Metadata = { title: "發起討論 — GreenThumb" };

export default function WritePage() {
  return <Suspense fallback={<p role="status">載入發文頁…</p>}><WriteDiscussion /></Suspense>;
}
