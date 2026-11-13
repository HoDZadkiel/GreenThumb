import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/server";
import { handleAuthRequest } from "@/lib/auth/http.mjs";

async function handle(request: NextRequest) {
  try {
    return await handleAuthRequest(getAuth(), request);
  } catch {
    return NextResponse.json({ message: "登入服務尚未就緒，請聯絡管理員。" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export { handle as GET, handle as POST };
