import type { SupabaseClient } from '@supabase/supabase-js';
import { ForumError, validateDraft, validPostId } from '@/lib/forum-input.mjs';
import { databaseError } from './forum';

export async function bookmarkIds(client: SupabaseClient) {
  const ids: string[] = [];
  for (let offset=0; ; offset+=1000) {
    const {data,error}=await client.from('post_bookmarks').select('post_id').order('post_id').range(offset,offset+999);
    if(error) throw databaseError(error);
    ids.push(...data.map(row=>String(row.post_id)));
    if(data.length<1000) return ids;
  }
}
export async function readDraft(client: SupabaseClient, userId: string, kind: string) {
  if(!['discussion','column'].includes(kind)) throw new ForumError('草稿類型不正確。');
  const {data,error}=await client.from('member_drafts').select('payload,updated_at').eq('user_id',userId).eq('kind',kind).maybeSingle();
  if(error) throw databaseError(error);
  return data;
}
export async function writeMemberData(client: SupabaseClient, userId: string, input: Record<string,unknown>) {
  if(input.action==='bookmark') {
    if(!validPostId(input.postId)||typeof input.saved!=='boolean') throw new ForumError('收藏資料不正確。');
    const query=input.saved ? client.from('post_bookmarks').upsert({user_id:userId,post_id:input.postId},{onConflict:'user_id,post_id',ignoreDuplicates:true})
      : client.from('post_bookmarks').delete().eq('user_id',userId).eq('post_id',input.postId);
    const {error}=await query;
    if(error) throw databaseError(error);
    return {saved:input.saved};
  }
  if(!['discussion','column'].includes(String(input.kind))) throw new ForumError('草稿類型不正確。');
  if(input.action==='saveDraft') {
    const payload=validateDraft(input.kind,input.payload);
    const {error}=await client.rpc('save_member_draft',{draft_kind:input.kind,draft_payload:payload});
    if(error) throw databaseError(error);
    return {ok:true};
  }
  if(input.action==='deleteDraft') {
    const {error}=await client.from('member_drafts').delete().eq('user_id',userId).eq('kind',input.kind);
    if(error) throw databaseError(error);
    return {ok:true};
  }
  throw new ForumError('不支援的操作。');
}
