import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

// All public content routes share a budget, including RSC/prefetch and the
// compatibility API. Rotating article IDs, paths or login cookies does not reset it.
export function contentReadPolicy(method, url) {
  if (!['GET','HEAD'].includes(method)) return null;
  const path = url.pathname.replace(/\/$/,'') || '/';
  if (['/api/forum','/api/trial-forum','/api/expert-columns'].includes(path)) return url.searchParams.has('id') ? 'detail' : 'list';
  if (['/','/discussions','/columns','/api/map-posts'].includes(path)) return 'list';
  if (path === '/api/article-interactions') return 'detail';
  if (/^\/discussions\/(?!write(?:\/|$))[^/]+$/.test(path) || /^\/columns\/(?!write(?:\/|$))[^/]+$/.test(path) || /^\/columns\/community\/[^/]+$/.test(path)) return 'detail';
  return null;
}

export function contentClientKey(headers, env = process.env) {
  // Only trust the deployment platform, never a client-selected cookie, User-Agent
  // or generic forwarded header on an untrusted/non-Vercel server.
  const raw = env.VERCEL === '1' ? headers.get('x-vercel-forwarded-for')?.trim() : null;
  let address = 'unattributed';
  if (raw && isIP(raw)) address = isIP(raw) === 6 ? new URL(`http://[${raw}]/`).hostname : raw;
  if (!env.BETTER_AUTH_SECRET) throw new Error('Content rate-limit secret is not configured.');
  return createHmac('sha256',env.BETTER_AUTH_SECRET).update(address).digest('hex');
}

export async function consumeContentRead(pool, key, policy, now = Date.now()) {
  const start = Math.floor(now / 60000) * 60000;
  const retryAfter = Math.max(1,Math.ceil((start + 60000 - now) / 1000));
  for (const [bucket,limit] of [['all',90],...(policy === 'list' ? [['list',30]] : [])]) {
    const {rows} = await pool.query(`with expired as (
      delete from public.gt_rate_limit where id in
        (select id from public.gt_rate_limit where key like 'content:v1:%' and key<>$1 and "lastRequest"<$4 limit 100)
    ) insert into public.gt_rate_limit (key,count,"lastRequest") values ($1,1,$2)
      on conflict (key) do update set count=case when gt_rate_limit."lastRequest"<$2 then 1 else least(gt_rate_limit.count+1,$3+1) end,
        "lastRequest"=greatest(gt_rate_limit."lastRequest",$2) returning count`,
      [`content:v1:${bucket}:${key}`,start,limit,now-86400000]);
    if (rows[0].count > limit) return {allowed:false,retryAfter};
  }
  return {allowed:true,retryAfter:0};
}

export function contentGuardResponse(api, status, retryAfter) {
  const message = status === 429 ? '讀取速度過快，請稍候再試。' : '暫時無法載入內容，請稍後再試。';
  const headers = {'Cache-Control':'private, no-store','Retry-After':String(retryAfter),'X-Robots-Tag':'noindex'};
  return api ? Response.json({error:message},{status,headers}) : new Response(
    `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message} — GreenThumb</title><body><main><h1>${message}</h1><p>請在 ${retryAfter} 秒後重新載入。</p><a href="/">返回 GreenThumb</a></main></body></html>`,
    {status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}
