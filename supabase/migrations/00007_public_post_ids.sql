-- Keep internal bigint foreign keys and existing ownership intact. Only the
-- random public identifier is accepted by the website and its APIs.
alter table public.posts add column public_id uuid not null default gen_random_uuid();
alter table public.posts add constraint posts_public_id_key unique (public_id);

-- The existing column-level insert/update grants intentionally exclude public_id:
-- members cannot choose predictable IDs or change published links.
comment on column public.posts.public_id is 'Random public article identifier; internal id is never exposed by application APIs.';
