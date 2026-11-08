-- Location sharing is opt-in. Existing posts keep a null district and no pin.
alter table public.posts add column region_code text references public.taiwan_regions(code);
create index posts_map_region_idx on public.posts(region_code, id desc)
  where region_code is not null and deleted_at is null;
grant insert (region_code), update (region_code) on public.posts to authenticated;

-- Keep the existing broad-region discussion filter in sync with the district.
-- Legacy posts without a district retain their original broad region.
create function public.sync_post_region() returns trigger
language plpgsql security invoker set search_path = public as $$
declare county_name text;
begin
  if new.region_code is not null then
    select county into county_name from public.taiwan_regions where code = new.region_code;
    new.region = case
      when county_name in ('基隆市','臺北市','新北市','桃園市','新竹市','新竹縣') then 'north'::public.region
      when county_name in ('苗栗縣','臺中市','彰化縣','南投縣','雲林縣') then 'central'::public.region
      when county_name in ('嘉義市','嘉義縣','臺南市','高雄市','屏東縣') then 'south'::public.region
      when county_name in ('宜蘭縣','花蓮縣','臺東縣') then 'east'::public.region
      when county_name in ('澎湖縣','金門縣','連江縣') then 'island'::public.region
      else null end;
  elsif tg_op = 'UPDATE' and old.region_code is not null then
    new.region = null;
  end if;
  return new;
end $$;
create trigger posts_sync_region before insert or update of region_code on public.posts
  for each row execute function public.sync_post_region();
revoke execute on function public.sync_post_region() from public, anon, authenticated;

notify pgrst, 'reload schema';
