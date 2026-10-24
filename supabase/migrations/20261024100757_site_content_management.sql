-- Public editorial content is read without a login; only the provisioned master
-- with an active Supabase Auth session can create, change, publish or remove it.
create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('program','playlist','team','gallery')),
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null default '' check (length(description) <= 4000),
  image_url text check (
    image_url is null or (
      length(image_url) <= 4096 and (
        image_url ~ '^https://[^[:space:]]+$' or
        image_url ~ '^/images/[a-z0-9][a-z0-9_-]*\.webp$'
      )
    )
  ),
  link_url text check (link_url is null or (length(link_url) <= 4096 and link_url ~ '^https://[^[:space:]]+$')),
  time_label text not null default '' check (length(time_label) <= 50),
  days_label text not null default '' check (length(days_label) <= 80),
  position integer not null default 0 check (position >= 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.site_content is 'Programs, playlists, team members and gallery entries managed exclusively by the master. Only enabled rows are public.';
alter table public.site_content enable row level security;
revoke all on public.site_content from public, anon, authenticated;
grant select on public.site_content to anon, authenticated;
grant insert (kind,title,description,image_url,link_url,time_label,days_label,position,enabled),
      update (kind,title,description,image_url,link_url,time_label,days_label,position,enabled),
      delete on public.site_content to authenticated;
create policy "Published site content" on public.site_content
  for select to anon, authenticated using (enabled);
create policy "Master reads all site content" on public.site_content
  for select to authenticated using ((select private.is_master()));
create policy "Master creates site content" on public.site_content
  for insert to authenticated with check ((select private.is_master()));
create policy "Master edits site content" on public.site_content
  for update to authenticated using ((select private.is_master())) with check ((select private.is_master()));
create policy "Master deletes site content" on public.site_content
  for delete to authenticated using ((select private.is_master()));
create index site_content_order on public.site_content (kind,position,created_at,id);

create function private.touch_site_content() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_site_content() from public, anon, authenticated;
create trigger site_content_updated before update on public.site_content
  for each row execute function private.touch_site_content();

alter table public.radio_settings
  add column contact_text text not null default '' check (length(contact_text) <= 2000),
  add column whatsapp_url text check (whatsapp_url is null or (length(whatsapp_url) <= 4096 and whatsapp_url ~ '^https://[^[:space:]]+$')),
  add column facebook_url text check (facebook_url is null or (length(facebook_url) <= 4096 and facebook_url ~ '^https://[^[:space:]]+$')),
  add column tiktok_url text check (tiktok_url is null or (length(tiktok_url) <= 4096 and tiktok_url ~ '^https://[^[:space:]]+$'));
-- Carry the public profile already requested into its editable setting.
update public.radio_settings set instagram_url='https://www.instagram.com/radiojkhiphop/'
where id=1 and instagram_url is null;

insert into public.site_content(kind,title,description,image_url,time_label,days_label,position,enabled) values
 ('program','Clássicos do Rap','Tocando as melhores dos anos 90 e 2000.','/images/vinyl.webp','22H — 00H','QUI A SÁB',0,true),
 ('program','NoBreack Hip-Hop','Tocando as melhores do rap nacional e internacional, sem intervalo.','/images/hero.webp','14H — 16H','TER A QUI',1,true),
 ('program','Pediu! Tocou','O ouvinte solicita o som na rádio e a gente toca as melhores do momento.','/images/crowd.webp','18H — 20H','SEG A SEX',2,true),
 ('program','Resenha Hip-Hop','Aquele programa com muita resenha, conversa boa e muita música.','/images/rapper.webp','08H — 09H','SEG A SEX',3,true);
-- Categories are visible, but no official playlist URLs have been supplied yet.
insert into public.site_content(kind,title,description,image_url,link_url,position,enabled) values
 ('playlist','Rap nacional','A voz das nossas ruas','/images/rapper.webp',null,0,true),
 ('playlist','Rap internacional','O movimento sem fronteiras','/images/hero.webp',null,1,true),
 ('playlist','Trap & new school','A próxima geração','/images/city.webp',null,2,true),
 ('playlist','Clássicos','Respeito às raízes','/images/vinyl.webp',null,3,true),
 ('playlist','Lançamentos','Novas batidas, novas ideias','/images/speakers.webp',null,4,true),
 ('playlist','Consciente','Palavra que transforma','/images/battle.webp',null,5,true),
 ('playlist','Boom bap','A essência da batida','/images/speakers.webp',null,6,true);
-- These are existing concept illustrations, never photographs of real events or staff.
insert into public.site_content(kind,title,description,image_url,position,enabled) values
 ('gallery','Voz do hip-hop','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/rapper.webp',0,true),
 ('gallery','Energia da plateia','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/crowd.webp',1,true),
 ('gallery','A cidade e a cultura','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/city.webp',2,true),
 ('gallery','Respeito ao vinil','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/vinyl.webp',3,true),
 ('gallery','Palavra e movimento','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/battle.webp',4,true),
 ('gallery','Na frequência do rap','Ilustração conceitual criada com IA. Não representa um artista ou evento real.','/images/hero.webp',5,true);

create function public.public_site_content() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'kind',c.kind,'title',c.title,'description',c.description,
        'image_url',c.image_url,'link_url',c.link_url,'time_label',c.time_label,
        'days_label',c.days_label,'position',c.position,'enabled',c.enabled,
        'created_at',c.created_at,'updated_at',c.updated_at
      ) order by c.kind,c.position,c.created_at,c.id)
      from public.site_content c where c.enabled
    ),'[]'::jsonb),
    'settings',coalesce((
      select jsonb_build_object(
        'stream_url',r.stream_url,'instagram_url',r.instagram_url,
        'youtube_url',r.youtube_url,'contact_email',r.contact_email,
        'contact_text',r.contact_text,'whatsapp_url',r.whatsapp_url,
        'facebook_url',r.facebook_url,'tiktok_url',r.tiktok_url
      ) from public.radio_settings r where r.id=1
    ),'{}'::jsonb)
  );
$$;
revoke all on function public.public_site_content() from public;
grant execute on function public.public_site_content() to anon, authenticated;
comment on function public.public_site_content() is 'Public, RLS-respecting snapshot; only enabled editorial entries and explicitly listed public radio settings. No private administration data.';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('deluxe-content','deluxe-content',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy "Master reads content files" on storage.objects for select to authenticated
  using (bucket_id='deluxe-content' and (select private.is_master()));
create policy "Master uploads content files" on storage.objects for insert to authenticated
  with check (bucket_id='deluxe-content' and name ~ '^(program|playlist|team|gallery)/[0-9a-f-]+\.(jpg|jpeg|png|webp|gif)$' and (select private.is_master()));
create policy "Master updates content files" on storage.objects for update to authenticated
  using (bucket_id='deluxe-content' and (select private.is_master()))
  with check (bucket_id='deluxe-content' and name ~ '^(program|playlist|team|gallery)/[0-9a-f-]+\.(jpg|jpeg|png|webp|gif)$' and (select private.is_master()));
create policy "Master removes content files" on storage.objects for delete to authenticated
  using (bucket_id='deluxe-content' and (select private.is_master()));

-- Correct the pre-existing escaped-dot expression, which rejected real .png paths.
alter policy "Master uploads banner files" on storage.objects
  with check (bucket_id='deluxe-banners' and name ~ '^(app|top|main)/[0-9a-f-]+\.(jpg|jpeg|png|webp|gif)$' and (select private.is_master()));
