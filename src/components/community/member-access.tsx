"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { memberAction } from "@/lib/member-client";
import type { ForumUser } from "./community-session";

export type LoginMethods = { google: boolean; email: boolean; password: boolean };

export async function readMemberSession(): Promise<{ user: ForumUser | null; auth: LoginMethods }> {
  const response = await fetch("/api/member-session", { cache: "no-store" });
  if (!response.ok) throw new Error("無法驗證登入狀態，請稍後再試。");
  return response.json();
}

export function MemberAccess({ user, methods, onSignedIn }: { user: ForumUser | null; methods: LoginMethods; onSignedIn: (user: ForumUser) => void }) {
  const [pending, setPending] = useState(false);
  const [waitingGoogle, setWaitingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function signInGoogle() {
    setError("");
    // Open synchronously so popup blocking cannot discard the member's unsaved editor.
    const popup = window.open("about:blank", "greenthumb-google", "popup,width=520,height=720");
    if (!popup) { setError("請允許開啟登入視窗，再按一次 Google 登入。"); return; }
    setPending(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/auth/complete", errorCallbackURL: "/auth/complete?error=google", disableRedirect: true });
      if (result.error || !result.data?.url) throw new Error("無法開啟 Google 登入，請稍後再試。");
      popup.location.href = result.data.url;
      setWaitingGoogle(true);
      const started = Date.now();
      let busy = false;
      const timer = window.setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
          const session = await readMemberSession();
          if (session.user) { stop(); popup.close(); setWaitingGoogle(false); setPending(false); onSignedIn(session.user); return; }
          // Google/browser COOP can sever the window handle while login is still running.
          if (Date.now() - started > 5 * 60_000) {
            stop(); popup.close(); setWaitingGoogle(false); setPending(false); setError("登入未完成，請再試一次。");
          }
        } catch {
          stop(); popup.close(); setWaitingGoogle(false); setPending(false); setError("無法驗證登入狀態，請稍後再試。");
        } finally { busy = false; }
      }, 2000);
      const stop = () => { window.clearInterval(timer); cleanup.current = null; };
      cleanup.current = () => { stop(); popup.close(); };
    } catch (caught) {
      popup.close(); setPending(false); setError((caught as Error).message);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const otp = new FormData(event.currentTarget).get("otp") as string;
      const result = sent
        ? await authClient.signIn.emailOtp({ email, otp })
        : await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (result.error) throw new Error(result.error.status === 429 ? "請求次數較多，請稍候再試。" : sent ? "驗證碼不正確或已過期，請重新確認。" : "驗證信暫時無法寄送，請稍後再試。");
      if (sent) {
        const session = await readMemberSession();
        if (!session.user) throw new Error("登入未完成，請再試一次。");
        onSignedIn(session.user);
      } else { setSent(true); setCooldown(60); }
    } catch (caught) { setError((caught as Error).message); }
    finally { setPending(false); }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({ email: String(fields.get("email") ?? ""), password: String(fields.get("password") ?? "") });
      if (result.error) throw new Error(result.error.status === 429 ? "登入嘗試次數較多，請稍候再試。" : "Email 或密碼不正確。");
      const session = await readMemberSession();
      if (!session.user) throw new Error("登入未完成，請再試一次。");
      onSignedIn(session.user);
    } catch (caught) { setError((caught as Error).message); }
    finally { setPending(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      await memberAction("profile", { name: new FormData(event.currentTarget).get("name") });
      const session = await readMemberSession();
      if (session.user) onSignedIn(session.user);
    } catch (caught) { setError((caught as Error).message); }
    finally { setPending(false); }
  }

  return user ? <>
    <h2 id="dialog-title">設定社群暱稱</h2>
    <p>選一個公開暱稱，讓大家認識你。</p>
    <form onSubmit={saveProfile}>
      <label>暱稱<input name="name" autoComplete="nickname" required maxLength={40} defaultValue={user.name === "新會員" ? "" : user.name} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={pending}>儲存暱稱</button>
    </form>
  </> : <>
    <h2 id="dialog-title">登入 GreenThumb</h2>
    <p className="dialog-footnote">{methods.password ? "請使用會員帳號的 Email 與密碼登入。" : "第一次使用 Google 或驗證碼登入會建立會員帳號，之後可設定公開暱稱。"}</p>
    {methods.password && <form className="password-login" onSubmit={submitPassword}>
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} /></label>
      <label>密碼<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={pending} /></label>
      <button className="primary-button" disabled={pending}>{pending && !waitingGoogle ? "登入中…" : "帳密登入"}</button>
    </form>}
    <button type="button" className="google-signin-button" disabled={!methods.google || pending} onClick={signInGoogle}>{waitingGoogle ? "正在完成登入…" : "使用 Google 繼續"}</button>
    {waitingGoogle && <button type="button" className="text-link" onClick={() => { cleanup.current?.(); setWaitingGoogle(false); setPending(false); }}>取消等待</button>}
    {!methods.google && !methods.email && !methods.password && <p role="status">登入目前尚未開放。</p>}
    {methods.email && <details className="email-login"><summary>Email 驗證碼登入</summary>
      <form onSubmit={submitEmail}>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} readOnly={sent} onChange={event => setEmail(event.target.value)} /></label>
        {sent && <><p role="status">驗證碼已寄出，請在 5 分鐘內輸入。</p><label>六位數驗證碼<input name="otp" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} /></label></>}
        <div className="trial-actions"><button className="primary-button" disabled={pending}>{sent ? "驗證並登入" : "寄送驗證碼"}</button>
          {sent && <button className="trial-draft-button" type="button" disabled={pending || cooldown > 0} onClick={() => setSent(false)}>{cooldown > 0 ? `${cooldown} 秒後可重新寄送` : "更換信箱／重新寄送"}</button>}
        </div>
      </form>
    </details>}
    {error && <p role="alert">{error}</p>}
  </>;
}
