-- Execute against the real project: all settings, banners, sessions and storage
-- metadata written here disappear on rollback. No image bytes are uploaded.
begin;
do $$
declare
  master uuid;
  sid uuid:=gen_random_uuid();
  draft uuid;
  live uuid;
  object_id uuid;
  changed integer;
  snapshot jsonb;
  slot_name text;
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('app_settings','app_banners') and c.relrowsecurity)<>2 then
    raise exception 'App RLS missing'; end if;
  if (select prosecdef from pg_proc where oid='public.public_app_config()'::regprocedure) then
    raise exception 'App public snapshot bypasses RLS'; end if;
  if not exists(select 1 from storage.buckets where id='deluxe-app' and public and file_size_limit=5242880
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/gif']
    and not ('image/svg+xml'=any(allowed_mime_types))) then raise exception 'App upload restrictions missing'; end if;
  if has_column_privilege('authenticated','public.app_banners','id','INSERT')
    or has_column_privilege('authenticated','public.app_banners','updated_at','UPDATE')
    or has_column_privilege('authenticated','public.app_settings','banner_interval_seconds','UPDATE') then
    raise exception 'Protected columns exposed'; end if;

  select user_id into master from private.admin_users;
  if master is null then raise exception 'Master must be provisioned'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(sid,master,now(),now(),'aal1');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() is not true then raise exception 'Active master denied'; end if;
  update public.app_settings set radio_name='JK HipHop QA',tagline='Temporário',logo_url='/images/hero.webp',
    background_url='https://example.com/background.webp',show_poll=false,show_contact=false where id=1;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Master settings update denied'; end if;
  foreach slot_name in array array['top','bottom'] loop
    insert into public.app_banners(title,alt_text,image_url,target_url,slot,position,enabled)
      values('Banner de QA','Descrição de QA','/images/hero.webp','https://example.com/qa',slot_name,999,false)
      returning id into draft;
    update public.app_banners set title='Banner editado de QA',enabled=true where id=draft;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Master banner update denied'; end if;
    delete from public.app_banners where id=draft;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Master banner deletion denied'; end if;
  end loop;
  insert into public.app_banners(title,slot) values('Rascunho privado de QA','top') returning id into draft;
  insert into public.app_banners(title,slot,image_url,enabled)
    values('Banner publicado de QA','bottom','https://example.com/banner.webp',true) returning id into live;
  if not exists(select 1 from public.app_banners where id=draft) then raise exception 'Master cannot read draft'; end if;
  snapshot:=public.public_app_config();
  if snapshot->'settings'->>'radio_name'<>'JK HipHop QA' or (snapshot->'settings'->>'show_poll')::boolean then
    raise exception 'App settings missing from public snapshot'; end if;
  if (select count(*) from jsonb_object_keys(snapshot->'settings'))<>8
    or (select count(*) from jsonb_object_keys(snapshot->'radio'))<>8 then raise exception 'Unexpected exposed configuration fields'; end if;
  if exists(select 1 from jsonb_array_elements(snapshot->'banners') b where b->>'id'=draft::text) then
    raise exception 'Public snapshot exposes master draft'; end if;
  begin
    update public.app_settings set logo_url='javascript:alert(1)' where id=1;
    raise exception 'Unsafe app image accepted';
  exception when check_violation then null; end;
  begin
    update public.app_settings set background_url='/images/hero.svg' where id=1;
    raise exception 'Untrusted local image format accepted';
  exception when check_violation then null; end;
  begin
    update public.app_settings set banner_interval_seconds=3 where id=1;
    raise exception 'Master can change fixed interval';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_banners(title,slot,enabled) values('Sem imagem de QA','top',true);
    raise exception 'Published image-less banner accepted';
  exception when check_violation then null; end;
  begin
    insert into public.app_banners(title,slot,target_url) values('Link inválido de QA','top','http://example.com');
    raise exception 'Non-HTTPS destination accepted';
  exception when check_violation then null; end;
  begin
    insert into public.app_banners(title,slot,position) values('Ordem inválida de QA','top',-1);
    raise exception 'Invalid order accepted';
  exception when check_violation then null; end;
  begin
    insert into public.app_banners(title,slot) values('Local inválido de QA','side');
    raise exception 'Invalid slot accepted';
  exception when check_violation then null; end;

  insert into storage.objects(bucket_id,name) values('deluxe-app','branding/'||gen_random_uuid()||'.png') returning id into object_id;
  update storage.objects set metadata='{"mimetype":"image/png","size":128}'::jsonb where id=object_id;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Master storage update/upsert denied'; end if;
  insert into storage.objects(bucket_id,name) values('deluxe-app','banner/'||gen_random_uuid()||'.webp');
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','branding/'||gen_random_uuid()||'.svg');
    raise exception 'SVG upload accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','other/'||gen_random_uuid()||'.png');
    raise exception 'Invalid upload folder accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','banner/not-a-uuid.png');
    raise exception 'Non-random upload path accepted';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  snapshot:=public.public_app_config();
  if exists(select 1 from public.app_banners where id=draft)
    or exists(select 1 from jsonb_array_elements(snapshot->'banners') b where b->>'id'=draft::text) then
    raise exception 'Visitor sees draft'; end if;
  if not exists(select 1 from jsonb_array_elements(snapshot->'banners') b where b->>'id'=live::text) then
    raise exception 'Visitor cannot see published banner'; end if;
  if snapshot->'settings'->>'banner_interval_seconds'<>'15' then raise exception 'Rotation interval incorrect'; end if;
  begin
    update public.app_settings set tagline='Public write' where id=1;
    raise exception 'Anonymous settings update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_settings(id) values(1);
    raise exception 'Anonymous singleton creation allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.app_settings where id=1;
    raise exception 'Anonymous singleton deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_banners(title,slot) values('Public write','top');
    raise exception 'Anonymous banner creation allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.app_banners set enabled=false where id=live;
    raise exception 'Anonymous banner edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.app_banners where id=live;
    raise exception 'Anonymous banner deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','banner/'||gen_random_uuid()||'.png');
    raise exception 'Anonymous image upload allowed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- A different subject cannot reuse the real master's active session.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() then raise exception 'Nonmaster authorized'; end if;
  if exists(select 1 from public.app_banners where id=draft) then raise exception 'Nonmaster sees draft'; end if;
  update public.app_settings set tagline='Nonmaster write' where id=1;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Nonmaster settings update allowed'; end if;
  begin
    insert into public.app_banners(title,slot) values('Nonmaster write','top');
    raise exception 'Nonmaster banner creation allowed';
  exception when insufficient_privilege then null; end;
  update public.app_banners set enabled=false where id=live;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Nonmaster banner edit allowed'; end if;
  delete from public.app_banners where id=live;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Nonmaster banner deletion allowed'; end if;
  if exists(select 1 from storage.objects where id=object_id) then raise exception 'Nonmaster lists app images'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','banner/'||gen_random_uuid()||'.png');
    raise exception 'Nonmaster image upload allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata='{}'::jsonb where id=object_id;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Nonmaster image update allowed'; end if;
  begin
    delete from storage.objects where id=object_id;
    get diagnostics changed=row_count;
    if changed<>0 then raise exception 'Nonmaster image deletion allowed'; end if;
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  delete from auth.sessions where id=sid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() then raise exception 'Revoked session authorized'; end if;
  update public.app_settings set tagline='Revoked write' where id=1;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Revoked session changes app settings'; end if;
  update public.app_banners set enabled=true where id=draft;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Revoked session publishes banner'; end if;
  begin
    insert into public.app_banners(title,slot) values('Revoked write','top');
    raise exception 'Revoked session creates banner';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-app','branding/'||gen_random_uuid()||'.png');
    raise exception 'Revoked session uploads image';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;
rollback;
select 'Android app: master CRUD/settings, public snapshot, draft privacy, session revocation, column grants, image paths and storage restrictions passed; QA changes rolled back' as result;
