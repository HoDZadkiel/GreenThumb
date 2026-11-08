import {cache} from 'react';
import {createClient} from '@/lib/supabase/server';
import {databaseError} from '@/lib/supabase/forum';
export type EditorialArticle={slug:string;title:string;excerpt:string;body:string;category:string;color:'sage'|'sand'|'rose'|'lilac';author_name:string};
export const listEditorials=cache(async()=>{
  const client=await createClient();
  const {data,error}=await client.from('editorial_articles').select('slug,title,excerpt,category,color,author_name').eq('published',true).order('sort_order').order('created_at',{ascending:false});
  if(error) throw databaseError(error);
  return data as Omit<EditorialArticle,'body'>[];
});
export const getEditorial=cache(async(slug:string)=>{
  if(!/^[a-z0-9-]{1,100}$/.test(slug))return null;
  const client=await createClient();
  const {data,error}=await client.from('editorial_articles').select('slug,title,excerpt,body,category,color,author_name').eq('slug',slug).eq('published',true).maybeSingle();
  if(error)throw databaseError(error);
  return data as EditorialArticle|null;
});
