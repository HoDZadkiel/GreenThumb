create table public.editorial_articles (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,100}$'),
  title text not null check (char_length(title) between 1 and 120),
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  body text not null check (char_length(body) between 1 and 20000),
  category text not null,
  color text not null default 'sage' check (color in ('sage','sand','rose','lilac')),
  author_name text not null default 'GreenThumb 編輯室',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.editorial_articles enable row level security;
create policy editorial_read on public.editorial_articles for select using (published or public.is_moderator());
create policy editorial_manage on public.editorial_articles for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
create trigger editorial_updated_at before update on public.editorial_articles for each row execute function public.set_updated_at();
revoke all on public.editorial_articles from anon, authenticated;
grant select on public.editorial_articles to anon, authenticated;
grant insert, update, delete on public.editorial_articles to authenticated;

create table public.member_drafts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('discussion','column')),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text) <= 40000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.member_drafts enable row level security;
create policy drafts_owner on public.member_drafts for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create trigger drafts_updated_at before update on public.member_drafts for each row execute function public.set_updated_at();
revoke all on public.member_drafts from anon, authenticated;
grant select, delete on public.member_drafts to authenticated;
grant insert (user_id,kind,payload), update (payload) on public.member_drafts to authenticated;

create function public.save_member_draft(draft_kind text, draft_payload jsonb) returns void
language sql security invoker set search_path = public as $$
  insert into public.member_drafts (user_id,kind,payload) values (auth.uid(),draft_kind,draft_payload)
  on conflict (user_id,kind) do update set payload=excluded.payload;
$$;
revoke execute on function public.save_member_draft(text,jsonb) from public,anon;
grant execute on function public.save_member_draft(text,jsonb) to authenticated;

create function public.clear_published_draft() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.member_drafts where user_id=new.author_id and user_id=auth.uid()
    and kind=case when tg_table_name='posts' then 'discussion' else 'column' end;
  return new;
end $$;
create trigger posts_clear_draft after insert on public.posts for each row execute function public.clear_published_draft();
create trigger columns_clear_draft after insert on public.expert_columns for each row execute function public.clear_published_draft();

create table public.post_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,post_id)
);
alter table public.post_bookmarks enable row level security;
create policy bookmarks_read on public.post_bookmarks for select to authenticated using (user_id=auth.uid());
create policy bookmarks_insert on public.post_bookmarks for insert to authenticated with check (
  user_id=auth.uid() and exists (select 1 from public.posts p where p.id=post_id and p.deleted_at is null)
);
create policy bookmarks_delete on public.post_bookmarks for delete to authenticated using (user_id=auth.uid());
revoke all on public.post_bookmarks from anon, authenticated;
grant select, delete on public.post_bookmarks to authenticated;
grant insert (user_id,post_id) on public.post_bookmarks to authenticated;

-- Existing editorial content is migrated below; no runtime hardcoded articles remain.

insert into public.editorial_articles (slug,title,excerpt,body,category,color,published,sort_order) values
('balcony-field-notes','從一盆植物開始，寫下你的陽台筆記','把光線、澆水和新葉記下來，回頭就能看見植物與季節的變化。','## 記下你每天看得到的事

先寫日期、植物的位置和葉片的變化。可以用「週日早上，窗邊有一片新葉」當開頭，再附一張同角度的照片。等下週回頭看，你就知道變化發生在什麼時候。

## 一次記錄一個調整

移盆、換介質或調整澆水時，記下原因與時間。分享時把環境也寫進去，讓其他人能判斷你的做法是否適合自己的陽台。','種植筆記','sage',true,0),
('photograph-your-plant','拍三個角度，讓植物照片更好讀','全株、葉片細節、盆土與擺放位置。每張照片都可以回答一個問題。','## 先拍整株，再靠近細節

全株照片能交代植株大小與變化的位置。接著拍一張清楚的葉片特寫。若背面也有異常，補一張背面的照片，並在文字說明是新葉還是舊葉。

## 讓讀者看見生長環境

拍攝盆器與周圍空間，或用文字說明光線、通風與最近一次澆水。發布前檢查照片背景，裁掉私人資訊並加上簡短的圖片說明。','實用教學','sand',true,1),
('ask-a-growing-question','怎麼問，才能收到更有幫助的回答？','用一句話描述問題，補上環境與已試過的方法，讓經驗可以傳下去。','## 在標題放上植物與問題

用「龜背芋的新葉一直不開背」比「請問怎麼辦」更容易被有相同經驗的人找到。內文補上問題發生多久、擺放位置與觀察到的變化。

## 回來補上後續結果

試過版友的方法後，可以回覆你調整了什麼、結果如何。遇到有幫助的回覆就標記為最佳解答，讓下次搜尋同一問題的人更快找到方向。','社群手記','rose',true,2)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
