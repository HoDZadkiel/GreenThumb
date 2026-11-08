import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/forum";
import { articleTarget, getInteractions, interact } from "@/lib/supabase/article-interactions";
import { failure, json, readInput } from "@/lib/forum-http";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const target = articleTarget(params.get("kind"), params.get("id"));
    const client = await createClient();
    return json(await getInteractions(client, await currentUser(client), target, params.get("cursor")));
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const input = await readInput(request);
    const target = articleTarget(input.kind, input.id);
    const client = await createClient();
    return json(await interact(client, await currentUser(client), target, input), input.action === "reply" ? 201 : 200);
  } catch (error) { return failure(error); }
}
