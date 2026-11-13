-- Application-owned authentication. These tables and policies use standard PostgreSQL.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'greenthumb_app') then
    create role greenthumb_app nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
grant anon, authenticated to greenthumb_app;
grant usage on schema public to greenthumb_app;

create table public.gt_user (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create table public.gt_session (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  "userId" uuid not null references public.gt_user(id) on delete cascade,
  "expiresAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index gt_session_user_idx on public.gt_session("userId");
create table public.gt_account (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references public.gt_user(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("providerId", "accountId")
);
create index gt_account_user_idx on public.gt_account("userId");
create table public.gt_verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index gt_verification_identifier_idx on public.gt_verification(identifier);
create table public.gt_rate_limit (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer not null,
  "lastRequest" bigint not null
);

-- Preserve legacy UUIDs and content ownership; old passwords/sessions are not imported.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email') then
    insert into public.gt_user (id,name,email,"emailVerified","createdAt","updatedAt")
    select u.id, coalesce(p.display_name,'新會員'), lower(u.email), u.email_confirmed_at is not null, u.created_at, now()
    from auth.users u left join public.profiles p on p.id=u.id where u.email is not null;
  end if;
  if exists (select 1 from public.profiles p left join public.gt_user u on u.id=p.id where u.id is null) then
    raise exception 'Some legacy profiles have no email identity. Resolve them before migrating.';
  end if;
end $$;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references public.gt_user(id) on delete cascade;

create function public.create_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Google names remain private until the member chooses a public nickname.
  insert into public.profiles (id,username,display_name)
  values (new.id,'user_' || substr(md5(new.id::text),1,15),'新會員');
  return new;
end $$;
revoke execute on function public.create_member_profile() from public, anon, authenticated, greenthumb_app;
create trigger gt_user_profile after insert on public.gt_user for each row execute function public.create_member_profile();

create function public.current_member_id() returns uuid
language sql stable set search_path = pg_catalog as $$
  select nullif(current_setting('app.user_id',true),'')::uuid;
$$;
revoke execute on function public.current_member_id() from public;
grant execute on function public.current_member_id() to anon, authenticated;

-- Replace the identity lookup without weakening any existing RLS predicates or grants.
do $$ declare p record; f record; expression text; statement text;
begin
  for p in select pol.polname, c.relname, pg_get_expr(pol.polqual,pol.polrelid) as using_expr,
      pg_get_expr(pol.polwithcheck,pol.polrelid) as check_expr
    from pg_policy pol join pg_class c on c.oid=pol.polrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (
      'profiles','boards','species','tags','posts','post_species','post_tags','replies','post_likes','reply_likes',
      'images','reports','expert_columns','editorial_articles','member_drafts','post_bookmarks','column_replies','column_likes'
    )
  loop
    statement := format('alter policy %I on public.%I',p.polname,p.relname);
    if p.using_expr is not null then
      expression := replace(p.using_expr,'auth.uid()','public.current_member_id()');
      statement := statement || ' using (' || expression || ')';
    end if;
    if p.check_expr is not null then
      expression := replace(p.check_expr,'auth.uid()','public.current_member_id()');
      statement := statement || ' with check (' || expression || ')';
    end if;
    execute statement;
  end loop;
  for f in select pr.oid from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace
    where n.nspname='public' and pr.prokind='f' and pr.proname in (
      'is_moderator','guard_profile_role','guard_post_fields','guard_reply_fields','save_member_draft','clear_published_draft'
    )
  loop
    statement := pg_get_functiondef(f.oid);
    if position('auth.uid()' in statement)>0 then
      execute replace(statement,'auth.uid()','public.current_member_id()');
    end if;
  end loop;
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
  end if;
end $$;

-- Only the private server connection can access auth data. The Data API roles cannot.
do $$ declare name text;
begin
  foreach name in array array['gt_user','gt_account','gt_session','gt_verification','gt_rate_limit'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public,anon,authenticated',name);
    execute format('grant select,insert,update,delete on public.%I to greenthumb_app',name);
    execute format('create policy auth_server on public.%I for all to greenthumb_app using (true) with check (true)',name);
  end loop;
end $$;
