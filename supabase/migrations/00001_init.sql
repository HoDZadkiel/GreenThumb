-- GreenThumb MVP schema. See docs/database-schema.md.

-- ========== 共用 ==========
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create domain public.region as text
  check (value in ('north', 'central', 'south', 'east', 'highland', 'island', 'indoor'));

-- ========== profiles ==========
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  bio          text check (char_length(bio) <= 500),
  region       public.region,
  role         text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  created_at   timestamptz not null default now()
);

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- 註冊時自動建立 profile；username 預設為 user_ 加上 id 雜湊的前 15 碼（總長 20，符合格式上限），之後由使用者修改
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(md5(new.id::text), 1, 15),
    coalesce(new.raw_user_meta_data->>'name', '新會員')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== boards / species / tags ==========
create table public.boards (
  id          smallint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  description text,
  sort_order  smallint not null default 0
);

create table public.species (
  id              bigint generated always as identity primary key,
  slug            text not null unique,
  scientific_name text not null unique,
  common_name     text not null,
  aliases         text[] not null default '{}',
  family          text,
  created_at      timestamptz not null default now()
);
create index species_aliases_idx on public.species using gin (aliases);

create table public.tags (
  id         bigint generated always as identity primary key,
  slug       text not null unique check (slug ~ '^[^\s#,/]{1,30}$'),
  name       text not null unique check (char_length(name) between 1 and 30),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ========== posts ==========
create table public.posts (
  id                bigint generated always as identity primary key,
  board_id          smallint not null references public.boards(id),
  author_id         uuid not null references public.profiles(id),
  post_type         text not null default 'question' check (post_type in ('question', 'share', 'guide')),
  region            public.region,
  title             text not null check (char_length(title) between 1 and 120),
  body              text not null check (char_length(body) between 1 and 20000),
  accepted_reply_id bigint,
  reply_count       integer not null default 0,
  like_count        integer not null default 0,
  is_pinned         boolean not null default false,
  is_locked         boolean not null default false,
  last_activity_at  timestamptz not null default now(),
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (accepted_reply_id is null or post_type = 'question')
);
create index posts_board_activity_idx on public.posts (board_id, is_pinned desc, last_activity_at desc)
  where deleted_at is null;
create index posts_region_activity_idx on public.posts (region, last_activity_at desc)
  where deleted_at is null;
create index posts_unanswered_idx on public.posts (last_activity_at desc)
  where deleted_at is null and post_type = 'question' and accepted_reply_id is null;
create index posts_author_idx on public.posts (author_id, created_at desc);
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_species (
  post_id    bigint not null references public.posts(id) on delete cascade,
  species_id bigint not null references public.species(id) on delete cascade,
  primary key (post_id, species_id)
);
create index post_species_species_idx on public.post_species (species_id);

create table public.post_tags (
  post_id bigint not null references public.posts(id) on delete cascade,
  tag_id  bigint not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

-- ========== replies ==========
create table public.replies (
  id              bigint generated always as identity primary key,
  post_id         bigint not null references public.posts(id) on delete cascade,
  author_id       uuid not null references public.profiles(id),
  parent_reply_id bigint references public.replies(id) on delete set null,
  body            text not null check (char_length(body) between 1 and 10000),
  like_count      integer not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, post_id)  -- 供 posts.accepted_reply_id 的複合外鍵參照
);
create index replies_post_idx on public.replies (post_id, created_at);
create trigger replies_updated_at before update on public.replies
  for each row execute function public.set_updated_at();

-- 最佳解答必須是這篇文章底下的回覆；回覆被刪時只清掉 accepted_reply_id（PG15+ 語法）
alter table public.posts
  add constraint posts_accepted_reply_fk
  foreign key (accepted_reply_id, id) references public.replies (id, post_id)
  on delete set null (accepted_reply_id);

-- 新增回覆時更新文章的回覆數與最後活動時間（軟刪除不扣回覆數，避免樓層跳號）
create or replace function public.bump_post_on_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.posts
     set reply_count = reply_count + 1,
         last_activity_at = new.created_at
   where id = new.post_id;
  return new;
end $$;

create trigger replies_bump_post after insert on public.replies
  for each row execute function public.bump_post_on_reply();

-- ========== likes ==========
create table public.post_likes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reply_likes (
  reply_id   bigint not null references public.replies(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

create or replace function public.sync_post_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = like_count - 1 where id = old.post_id;
  end if;
  return null;
end $$;

create or replace function public.sync_reply_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.replies set like_count = like_count + 1 where id = new.reply_id;
  else
    update public.replies set like_count = like_count - 1 where id = old.reply_id;
  end if;
  return null;
end $$;

create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.sync_post_like_count();
create trigger reply_likes_count after insert or delete on public.reply_likes
  for each row execute function public.sync_reply_like_count();

-- ========== images ==========
create table public.images (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null references public.profiles(id),
  storage_path text not null unique,
  width        integer check (width > 0),
  height       integer check (height > 0),
  post_id      bigint references public.posts(id) on delete cascade,
  reply_id     bigint references public.replies(id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- 上傳後尚未送出時兩者都是 null；送出後只能掛在其中一個
  check (post_id is null or reply_id is null)
);
create index images_post_idx on public.images (post_id) where post_id is not null;
create index images_reply_idx on public.images (reply_id) where reply_id is not null;

-- ========== reports ==========
create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id),
  post_id     bigint references public.posts(id) on delete cascade,
  reply_id    bigint references public.replies(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(post_id, reply_id) = 1)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- ========== 欄位保護 ==========
-- RLS 無法逐欄位比對新舊值，所以用 trigger 擋住一般會員修改特權欄位
-- auth.uid() 為 null 代表後台（SQL Editor / service_role），不攔
-- pg_trigger_depth() = 1 代表使用者直接 UPDATE；由計數 trigger 觸發的更新是 depth 2，放行
create or replace function public.guard_profile_role() returns trigger
language plpgsql as $$
begin
  -- 角色只能從後台變更，版主也不能自行升級為 admin
  if new.role is distinct from old.role and auth.uid() is not null then
    new.role = old.role;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_role();

create or replace function public.guard_post_fields() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null then
    new.reply_count      = old.reply_count;
    new.like_count       = old.like_count;
    new.last_activity_at = old.last_activity_at;
    if not public.is_moderator() then
      new.is_pinned = old.is_pinned;
      new.is_locked = old.is_locked;
    end if;
  end if;
  return new;
end $$;

create trigger posts_guard before update on public.posts
  for each row execute function public.guard_post_fields();

create or replace function public.guard_reply_fields() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null then
    new.like_count = old.like_count;
    new.post_id    = old.post_id;
  end if;
  return new;
end $$;

create trigger replies_guard before update on public.replies
  for each row execute function public.guard_reply_fields();

-- ========== RLS ==========
alter table public.profiles     enable row level security;
alter table public.boards       enable row level security;
alter table public.species      enable row level security;
alter table public.tags         enable row level security;
alter table public.posts        enable row level security;
alter table public.post_species enable row level security;
alter table public.post_tags    enable row level security;
alter table public.replies      enable row level security;
alter table public.post_likes   enable row level security;
alter table public.reply_likes  enable row level security;
alter table public.images       enable row level security;
alter table public.reports      enable row level security;

-- profiles：所有人可讀；只能改自己的（role 由 trigger 保護）
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- boards / species：所有人可讀，版主可寫
create policy boards_read  on public.boards  for select using (true);
create policy boards_mod   on public.boards  for all using (public.is_moderator()) with check (public.is_moderator());
create policy species_read on public.species for select using (true);
create policy species_mod  on public.species for all using (public.is_moderator()) with check (public.is_moderator());

-- tags：所有人可讀；登入會員可新增；只有版主能改名或刪除
create policy tags_read       on public.tags for select using (true);
create policy tags_insert     on public.tags for insert to authenticated with check (created_by = auth.uid());
create policy tags_mod_update on public.tags for update using (public.is_moderator()) with check (public.is_moderator());
create policy tags_mod_delete on public.tags for delete using (public.is_moderator());

-- posts：未刪除的所有人可讀；登入者可以用自己的身分發文；作者或版主可以修改
create policy posts_read on public.posts for select
  using (deleted_at is null or author_id = auth.uid() or public.is_moderator());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and not is_pinned and not is_locked
              and reply_count = 0 and like_count = 0 and accepted_reply_id is null);
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());

-- post_species / post_tags：所有人可讀；只有文章作者或版主可以增刪
create policy post_species_read on public.post_species for select using (true);
create policy post_species_write on public.post_species for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_moderator())))
  with check (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_moderator())));
create policy post_tags_read on public.post_tags for select using (true);
create policy post_tags_write on public.post_tags for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_moderator())))
  with check (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_moderator())));

-- replies：未刪除的所有人可讀；文章未鎖定、未刪除時登入者才能回覆
create policy replies_read on public.replies for select
  using (deleted_at is null or author_id = auth.uid() or public.is_moderator());
create policy replies_insert on public.replies for insert to authenticated
  with check (
    author_id = auth.uid() and like_count = 0
    and exists (select 1 from public.posts p where p.id = post_id and not p.is_locked and p.deleted_at is null)
  );
create policy replies_update on public.replies for update to authenticated
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());

-- likes：所有人可讀；只能以自己的身分按讚、收回
create policy post_likes_read    on public.post_likes  for select using (true);
create policy post_likes_insert  on public.post_likes  for insert to authenticated with check (user_id = auth.uid());
create policy post_likes_delete  on public.post_likes  for delete to authenticated using (user_id = auth.uid());
create policy reply_likes_read   on public.reply_likes for select using (true);
create policy reply_likes_insert on public.reply_likes for insert to authenticated with check (user_id = auth.uid());
create policy reply_likes_delete on public.reply_likes for delete to authenticated using (user_id = auth.uid());

-- images：所有人可讀；只能新增、修改、刪除自己的
create policy images_read on public.images for select using (true);
create policy images_write on public.images for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- reports：登入者可以檢舉；只有版主能讀取和處理
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy reports_mod on public.reports for select using (public.is_moderator());
create policy reports_mod_update on public.reports for update using (public.is_moderator()) with check (public.is_moderator());
