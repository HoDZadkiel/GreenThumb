import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/forum-input.mjs";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash"), type = request.nextUrl.searchParams.get("type");
  if (tokenHash && type === "email") {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.nextUrl.origin));
  }
  return NextResponse.redirect(new URL("/?auth_error=confirmation", request.nextUrl.origin));
}
