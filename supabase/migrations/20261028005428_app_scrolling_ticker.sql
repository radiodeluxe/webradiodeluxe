-- Additive settings: existing APK versions safely ignore these public fields.
-- Existing master-only RLS and update trigger remain in force.
alter table public.app_settings
  add column ticker_enabled boolean not null default true,
  add column ticker_text text not null default 'JK HipHop • O rap em alto nível. • Siga @radiojkhiphop',
  add column ticker_text_color text not null default 'black',
  add constraint app_settings_ticker_text_length check (length(ticker_text)<=300 and ticker_text !~ '[[:cntrl:]]'),
  add constraint app_settings_ticker_text_color check (ticker_text_color in ('black','white')),
  add constraint app_settings_ticker_message_required check (not ticker_enabled or length(trim(ticker_text))>0);

grant update (ticker_enabled,ticker_text,ticker_text_color) on public.app_settings to authenticated;
comment on column public.app_settings.ticker_text is 'Plain text message below the app advertisement. No HTML. Maximum 300 characters.';

create or replace function public.public_app_config() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'settings',coalesce((select jsonb_build_object(
      'radio_name',s.radio_name,'tagline',s.tagline,'logo_url',s.logo_url,
      'background_url',s.background_url,'show_poll',s.show_poll,'show_contact',s.show_contact,
      'ticker_enabled',s.ticker_enabled,'ticker_text',s.ticker_text,'ticker_text_color',s.ticker_text_color,
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

