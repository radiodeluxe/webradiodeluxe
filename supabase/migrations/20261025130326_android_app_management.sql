-- The APK has no administrative login. Its public configuration is shared with
-- the website; only the provisioned master with a live Auth session can edit it.
create table public.app_settings (
  id smallint primary key default 1 constraint app_settings_singleton check (id=1),
  radio_name text not null default 'JK HipHop'
    constraint app_settings_radio_name_length check (length(trim(radio_name)) between 3 and 80),
  tagline text not null default 'O rap em alto nível.'
    constraint app_settings_tagline_length check (length(tagline)<=160),
  logo_url text constraint app_settings_logo_url_safe check (
    logo_url is null or (length(logo_url)<=4096 and (
      logo_url ~ '^https://[^[:space:]]+$' or logo_url ~ '^/images/[a-z0-9][a-z0-9_-]*\.webp$'))),
  background_url text constraint app_settings_background_url_safe check (
    background_url is null or (length(background_url)<=4096 and (
      background_url ~ '^https://[^[:space:]]+$' or background_url ~ '^/images/[a-z0-9][a-z0-9_-]*\.webp$'))),
  show_poll boolean not null default true,
  show_contact boolean not null default true,
  banner_interval_seconds smallint not null default 15
    constraint app_settings_banner_interval_fixed check (banner_interval_seconds=15),
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'Public Android branding and menu switches. A null image retains the APK bundled design. Rotation remains fixed at 15 seconds.';
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public,anon,authenticated;
grant select on public.app_settings to anon,authenticated;
grant update (radio_name,tagline,logo_url,background_url,show_poll,show_contact) on public.app_settings to authenticated;
create policy "Public app settings" on public.app_settings
  for select to anon,authenticated using (true);
create policy "Master edits app settings" on public.app_settings
  for update to authenticated using ((select private.is_master())) with check ((select private.is_master()));
create trigger app_settings_updated before update on public.app_settings
  for each row execute function private.touch_site_content();
insert into public.app_settings(id) values(1);

create table public.app_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null constraint app_banners_title_length check (length(trim(title)) between 3 and 120),
  alt_text text not null default '' constraint app_banners_alt_length check (length(alt_text)<=240),
  image_url text constraint app_banners_image_url_safe check (
    image_url is null or (length(image_url)<=4096 and (
      image_url ~ '^https://[^[:space:]]+$' or image_url ~ '^/images/[a-z0-9][a-z0-9_-]*\.webp$'))),
  target_url text constraint app_banners_target_url_safe check (
    target_url is null or (length(target_url)<=4096 and target_url ~ '^https://[^[:space:]]+$')),
  slot text not null constraint app_banners_slot check (slot in ('top','bottom')),
  position integer not null default 0 constraint app_banners_position check (position between 0 and 9999),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_banners_published_image check (not enabled or image_url is not null)
);
comment on table public.app_banners is 'Two independent Android advertising slots; only enabled rows are public. No example advertisers are inserted.';
alter table public.app_banners enable row level security;
revoke all on public.app_banners from public,anon,authenticated;
grant select on public.app_banners to anon,authenticated;
grant insert (title,alt_text,image_url,target_url,slot,position,enabled),
      update (title,alt_text,image_url,target_url,slot,position,enabled),
      delete on public.app_banners to authenticated;
create policy "Published app banners" on public.app_banners
  for select to anon,authenticated using (enabled);
create policy "Master reads app banners" on public.app_banners
  for select to authenticated using ((select private.is_master()));
create policy "Master creates app banners" on public.app_banners
  for insert to authenticated with check ((select private.is_master()));
create policy "Master edits app banners" on public.app_banners
  for update to authenticated using ((select private.is_master())) with check ((select private.is_master()));
create policy "Master removes app banners" on public.app_banners
  for delete to authenticated using ((select private.is_master()));
create index app_banners_public_order on public.app_banners (slot,position,created_at,id) where enabled;
create trigger app_banners_updated before update on public.app_banners
  for each row execute function private.touch_site_content();

create function public.public_app_config() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'settings',coalesce((select jsonb_build_object(
      'radio_name',s.radio_name,'tagline',s.tagline,'logo_url',s.logo_url,
      'background_url',s.background_url,'show_poll',s.show_poll,'show_contact',s.show_contact,
      'banner_interval_seconds',s.banner_interval_seconds,'updated_at',s.updated_at
    ) from public.app_settings s where s.id=1),'{}'::jsonb),
    'radio',coalesce((select jsonb_build_object(
      'stream_url',r.stream_url,'instagram_url',r.instagram_url,'youtube_url',r.youtube_url,
      'contact_email',r.contact_email,'contact_text',r.contact_text,'whatsapp_url',r.whatsapp_url,
      'facebook_url',r.facebook_url,'tiktok_url',r.tiktok_url
    ) from public.radio_settings r where r.id=1),'{}'::jsonb),
    'banners',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'title',b.title,'alt_text',b.alt_text,'image_url',b.image_url,
      'target_url',b.target_url,'slot',b.slot,'position',b.position,'enabled',b.enabled,
      'created_at',b.created_at,'updated_at',b.updated_at
    ) order by b.slot,b.position,b.created_at,b.id) from public.app_banners b where b.enabled),'[]'::jsonb)
  );
$$;
revoke all on function public.public_app_config() from public;
grant execute on function public.public_app_config() to anon,authenticated;
comment on function public.public_app_config() is 'Public RLS-respecting Android snapshot. Explicit public fields only, enabled banners only, no credentials or private administration data.';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('deluxe-app','deluxe-app',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy "Master reads app images" on storage.objects for select to authenticated
  using (bucket_id='deluxe-app' and (select private.is_master()));
create policy "Master uploads app images" on storage.objects for insert to authenticated
  with check (bucket_id='deluxe-app' and name ~ '^(branding|banner)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$' and (select private.is_master()));
create policy "Master edits app images" on storage.objects for update to authenticated
  using (bucket_id='deluxe-app' and (select private.is_master()))
  with check (bucket_id='deluxe-app' and name ~ '^(branding|banner)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$' and (select private.is_master()));
create policy "Master removes app images" on storage.objects for delete to authenticated
  using (bucket_id='deluxe-app' and (select private.is_master()));
