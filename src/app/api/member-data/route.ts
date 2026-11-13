import { NextRequest } from 'next/server';
import { createClient } from '@/lib/db/server';
import { currentUser } from '@/lib/db/forum';
import { bookmarkIds,readDraft,writeMemberData } from '@/lib/db/member-data';
import { failure,json,readInput } from '@/lib/forum-http';
import { ForumError } from '@/lib/forum-input.mjs';
export async function GET(request: NextRequest) {
  try {
    const client=await createClient(), user=await currentUser(client);
    const kind=request.nextUrl.searchParams.get('kind');
    if(!user) return json(kind?{draft:null}:{bookmarks:[]});
    return json(kind?{draft:await readDraft(client,user.id,kind)}:{bookmarks:await bookmarkIds(client)});
  }catch(error){return failure(error);}
}
export async function POST(request: NextRequest) {
  try {
    const input=await readInput(request),client=await createClient(),user=await currentUser(client);
    if(!user) throw new ForumError('請先登入，再儲存草稿或收藏。',401);
    return json(await writeMemberData(client,user.id,input));
  }catch(error){return failure(error);}
}
