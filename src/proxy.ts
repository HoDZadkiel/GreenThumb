import { NextRequest, NextResponse } from "next/server";
import { withContentLimitDatabase } from "@/lib/db/pool.mjs";
import { contentClientKey, contentGuardResponse, contentReadPolicy, consumeContentRead } from "@/lib/content-guard.mjs";

// Protected APIs validate the database session themselves.
export async function proxy(request: NextRequest) {
  const policy = contentReadPolicy(request.method,request.nextUrl);
  if (policy) {
    try {
      const key = contentClientKey(request.headers);
      const result = await withContentLimitDatabase(pool=>consumeContentRead(pool,key,policy));
      if (!result.allowed) return contentGuardResponse(request.nextUrl.pathname.startsWith('/api/'),429,result.retryAfter);
    } catch {
      // Do not expose database errors, and do not silently disable protection.
      return contentGuardResponse(request.nextUrl.pathname.startsWith('/api/'),503,30);
    }
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  if(request.nextUrl.pathname.startsWith('/api/')) response.headers.set('X-Robots-Tag','noindex');
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
