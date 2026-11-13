import {cache} from 'react';
import {createClient} from '@/lib/db/server';
export type EditorialArticle={slug:string;title:string;excerpt:string;body:string;category:string;color:'sage'|'sand'|'rose'|'lilac';author_name:string};
export const listEditorials=cache(async()=>{
  const client=await createClient();
  const {rows}=await client.query("select slug,title,excerpt,category,color,author_name from public.editorial_articles where published order by sort_order,created_at desc");
  return rows as Omit<EditorialArticle,'body'>[];
});
export const getEditorial=cache(async(slug:string)=>{
  if(!/^[a-z0-9-]{1,100}$/.test(slug))return null;
  const client=await createClient();
  const {rows}=await client.query("select slug,title,excerpt,body,category,color,author_name from public.editorial_articles where slug=$1 and published",[slug]);
  return (rows[0] ?? null) as EditorialArticle|null;
});
