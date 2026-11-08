import type { Metadata } from "next";
import { Suspense } from "react";
import { WriteExpertColumn } from "@/components/columns/expert-column-composer";

export const metadata: Metadata = { title: "發表在地專欄 — GreenThumb" };
export default function WriteColumnPage() {
  return <Suspense fallback={<p role="status">載入專欄編輯器…</p>}><WriteExpertColumn /></Suspense>;
}
