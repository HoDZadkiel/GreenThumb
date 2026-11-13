import { authSettings } from "./config.mjs";

const commonPaths = new Set(["/sign-in/social", "/callback/google", "/get-session", "/sign-out", "/error"]);
const emailPaths = new Set(["/email-otp/send-verification-otp", "/sign-in/email-otp"]);

export async function handleAuthRequest(auth, request, env = process.env) {
  const settings = authSettings(env);
  const path = new URL(request.url).pathname.slice("/api/auth".length);
  const json = (message, status) => Response.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!commonPaths.has(path) && !(settings.emailEnabled && emailPaths.has(path)) && !(settings.passwordEnabled && path === "/sign-in/email")) return json("找不到此登入方式。", 404);
  if (request.method === "POST" && path !== "/callback/google") {
    if (request.headers.get("origin") !== settings.baseURL) return json("請從 GreenThumb 操作。", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json("請求格式不正確。", 415);
    const reader = request.body?.getReader();
    if (!reader) return json("請求格式不正確。", 400);
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); return json("內容過長。", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json("請求格式不正確。", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json("請求格式不正確。", 400);
    if (path === "/sign-in/social") {
      const allowed = new Set(["provider", "callbackURL", "errorCallbackURL", "disableRedirect"]);
      if (body.provider !== "google" || Object.keys(body).some(key => !allowed.has(key))) return json("不支援的登入請求。", 400);
      body.callbackURL = "/auth/complete";
      body.errorCallbackURL = "/auth/complete?error=google";
    }
    if (path === "/email-otp/send-verification-otp" && body.type !== "sign-in") return json("不支援的驗證類型。", 400);
    if (path === "/sign-in/email") {
      const allowed = new Set(["email", "password", "rememberMe"]);
      if (Object.keys(body).some(key => !allowed.has(key)) || typeof body.email !== "string" || body.email.length > 254 ||
          typeof body.password !== "string" || !body.password || body.password.length > 128 ||
          (body.rememberMe !== undefined && typeof body.rememberMe !== "boolean")) return json("請輸入有效的 Email 與密碼。", 400);
      body.email = body.email.trim().toLowerCase();
    }
    // Next.js may wrap Request in a Proxy; Undici cannot clone its private fields.
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    request = new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) });
  }
  if (path === "/error") return Response.redirect(settings.baseURL + "/auth/complete?error=google", 302);
  const response = await auth.handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
