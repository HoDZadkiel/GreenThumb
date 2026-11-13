import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { listMappedPosts } from "@/lib/db/forum";
import { failure, json } from "@/lib/forum-http";

export async function GET(request: NextRequest) {
  try {
    return json(await listMappedPosts(await createClient(), request.nextUrl.searchParams.get("cursor")));
  } catch (error) { return failure(error); }
}
