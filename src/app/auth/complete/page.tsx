"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AuthComplete() {
  const [status, setStatus] = useState<"checking" | "complete" | "failed">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member-session", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (!controller.signal.aborted) setStatus(data.user && !new URLSearchParams(window.location.search).has("error") ? "complete" : "failed"); })
      .catch(() => { if (!controller.signal.aborted) setStatus("failed"); });
    return () => controller.abort();
  }, []);
  return <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
    <h1>{status === "checking" ? "正在確認登入…" : status === "failed" ? "登入未完成" : "已完成 Google 登入"}</h1>
    <p>{status === "checking" ? "請稍候。" : status === "failed" ? "請關閉此視窗，回到原頁面重新登入。" : "可以關閉此視窗，原頁面會繼續你的操作。"}</p>
    <Link href="/">回到 GreenThumb</Link>
  </main>;
}
