create table public.ad_banners (
  id text primary key check (id in ('app','top','main')),
  title text not null check (length(title) between 2 and 120),
  alt_text text not null default '' check (length(alt_text) <= 180),
  image_url text check (image_url is null or image_url ~ '^https://'),
  target_url text check (target_url is null or target_url ~ '^https://'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.ad_banners enable row level security;
revoke all on public.ad_banners from anon, authenticated;
grant select on public.ad_banners to anon, authenticated;
grant update (title,alt_text,image_url,target_url,enabled,updated_at) on public.ad_banners to authenticated;
create policy "Active banners are public" on public.ad_banners for select to anon, authenticated using (enabled);
create policy "Master reads all banners" on public.ad_banners for select to authenticated using ((select private.is_master()));
create policy "Master updates banners" on public.ad_banners for update to authenticated using ((select private.is_master())) with check ((select private.is_master()));
insert into public.ad_banners(id,title) values ('app','Aplicativo / topo'),('top','Publicidade superior'),('main','Publicidade principal');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('deluxe-banners','deluxe-banners',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy "Master reads banner files" on storage.objects for select to authenticated using (bucket_id='deluxe-banners' and (select private.is_master()));
create policy "Master uploads banner files" on storage.objects for insert to authenticated with check (bucket_id='deluxe-banners' and name ~ '^(app|top|main)/[0-9a-f-]+\.(jpg|png|webp|gif)$' and (select private.is_master()));
create policy "Master removes banner files" on storage.objects for delete to authenticated using (bucket_id='deluxe-banners' and (select private.is_master()));
