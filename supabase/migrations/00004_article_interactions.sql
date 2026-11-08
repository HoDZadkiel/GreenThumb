-- Discussion replies/likes reuse the original tables; both kinds of columns
-- share these tables with real foreign keys and exactly one article target.
create table public.column_replies (
  id bigint generated always as identity primary key,
  column_id uuid references public.expert_columns(id) on delete cascade,
  editorial_slug text references public.editorial_articles(slug) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(column_id, editorial_slug) = 1)
);
create index column_replies_column_idx on public.column_replies(column_id, id);
create index column_replies_editorial_idx on public.column_replies(editorial_slug, id);
create index column_replies_author_idx on public.column_replies(author_id);

create table public.column_likes (
  id bigint generated always as identity primary key,
  column_id uuid references public.expert_columns(id) on delete cascade,
  editorial_slug text references public.editorial_articles(slug) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(column_id, editorial_slug) = 1),
  unique (column_id, user_id),
  unique (editorial_slug, user_id)
);
create index column_likes_user_idx on public.column_likes(user_id);

alter table public.column_replies enable row level security;
alter table public.column_likes enable row level security;

create policy column_replies_read on public.column_replies for select using (
  exists (select 1 from public.expert_columns c where c.id = column_id)
  or exists (select 1 from public.editorial_articles e where e.slug = editorial_slug and e.published)
);
create policy column_replies_insert on public.column_replies for insert to authenticated with check (
  author_id = (select auth.uid()) and (
    exists (select 1 from public.expert_columns c where c.id = column_id)
    or exists (select 1 from public.editorial_articles e where e.slug = editorial_slug and e.published)
  )
);
create policy column_likes_read on public.column_likes for select using (
  exists (select 1 from public.expert_columns c where c.id = column_id)
  or exists (select 1 from public.editorial_articles e where e.slug = editorial_slug and e.published)
);
create policy column_likes_insert on public.column_likes for insert to authenticated with check (
  user_id = (select auth.uid()) and (
    exists (select 1 from public.expert_columns c where c.id = column_id)
    or exists (select 1 from public.editorial_articles e where e.slug = editorial_slug and e.published)
  )
);
create policy column_likes_delete on public.column_likes for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.column_replies, public.column_likes from anon, authenticated;
grant select on public.column_replies, public.column_likes to anon, authenticated;
grant insert (column_id, editorial_slug, author_id, body) on public.column_replies to authenticated;
grant insert (column_id, editorial_slug, user_id) on public.column_likes to authenticated;
grant delete on public.column_likes to authenticated;
grant usage, select on sequence public.column_replies_id_seq, public.column_likes_id_seq to authenticated;

-- Explicit grants were missing for the existing discussion interaction tables.
grant insert (post_id, author_id, body) on public.replies to authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;
grant delete on public.post_likes to authenticated;
drop policy post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null)
);

notify pgrst, 'reload schema';
