-- Real roles and a temporary active master session; every row and setting rolls back.
begin;

do $$
declare
  master uuid;
  sid uuid := gen_random_uuid();
  draft_id uuid;
  live_id uuid;
  object_id uuid;
  affected integer;
  snapshot jsonb;
  kind_name text;
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='site_content' and c.relrowsecurity) then
    raise exception 'Content RLS missing';
  end if;
  if (select prosecdef from pg_proc where oid='public.public_site_content()'::regprocedure) then
    raise exception 'Public snapshot must not bypass RLS';
  end if;
  if not exists(select 1 from storage.buckets where id='deluxe-content' and public
    and file_size_limit=5242880
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/gif']
    and not ('image/svg+xml'=any(allowed_mime_types))) then
    raise exception 'Content image restrictions missing';
  end if;

  select user_id into master from private.admin_users;
  if master is null then raise exception 'Master must be provisioned first'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at,aal)
    values(sid,master,now(),now(),'aal1');
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',master,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() is not true then raise exception 'Active master denied'; end if;

  -- All four modules share the same enforced ownership and publishing rules.
  foreach kind_name in array array['program','playlist','team','gallery'] loop
    insert into public.site_content(kind,title,description,image_url,link_url,time_label,days_label,position,enabled)
      values(kind_name,'Conteúdo temporário de QA','Texto temporário de QA','/images/hero.webp',
        'https://example.com/qa','18H — 20H','SEG A SEX',999,false)
      returning id into draft_id;
    update public.site_content set title='Conteúdo atualizado de QA' where id=draft_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Master update failed for %',kind_name; end if;
    delete from public.site_content where id=draft_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Master delete failed for %',kind_name; end if;
  end loop;
  insert into public.site_content(kind,title,enabled) values('program','Rascunho privado de QA',false)
    returning id into draft_id;
  insert into public.site_content(kind,title,enabled) values('gallery','Conteúdo publicado de QA',true)
    returning id into live_id;
  if not exists(select 1 from public.site_content where id=draft_id) then
    raise exception 'Master cannot see own drafts';
  end if;
  update public.radio_settings set contact_text='Contato temporário de QA',
    contact_email='qa@example.com',instagram_url='https://www.instagram.com/qa/',
    youtube_url='https://www.youtube.com/@qa',whatsapp_url='https://wa.me/5511999999999',
    facebook_url='https://www.facebook.com/qa',tiktok_url='https://www.tiktok.com/@qa' where id=1;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Master cannot edit contact/socials'; end if;
  snapshot := public.public_site_content();
  if snapshot->'settings'->>'contact_text'<>'Contato temporário de QA'
    or snapshot->'settings'->>'facebook_url'<>'https://www.facebook.com/qa' then
    raise exception 'Saved public settings do not appear in snapshot';
  end if;
  if exists(select 1 from jsonb_array_elements(snapshot->'items') item
    where item->>'id'=draft_id::text) then raise exception 'Snapshot exposes master drafts'; end if;

  begin
    insert into public.site_content(kind,title,image_url) values('team','Imagem inválida','javascript:alert(1)');
    raise exception 'Unsafe image URL accepted';
  exception when check_violation then null; end;
  begin
    insert into public.site_content(kind,title,image_url) values('team','Imagem inválida','/images/hero.svg');
    raise exception 'Unsafe local file accepted';
  exception when check_violation then null; end;
  begin
    insert into public.site_content(kind,title,link_url) values('playlist','Link inválido','http://example.com');
    raise exception 'Non-HTTPS link accepted';
  exception when check_violation then null; end;
  begin
    update public.radio_settings set whatsapp_url='javascript:alert(1)' where id=1;
    raise exception 'Unsafe contact link accepted';
  exception when check_violation then null; end;

  -- Test storage policies against actual metadata rows; transaction rollback prevents orphan files.
  insert into storage.objects(bucket_id,name) values('deluxe-content','program/'||gen_random_uuid()||'.png')
    returning id into object_id;
  update storage.objects set metadata='{"mimetype":"image/png","size":128}'::jsonb where id=object_id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Master content image upsert/update denied'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-content','program/'||gen_random_uuid()||'.svg');
    raise exception 'SVG storage upload allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-content','other/'||gen_random_uuid()||'.png');
    raise exception 'Invalid storage folder allowed';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id,name) values('deluxe-banners','top/'||gen_random_uuid()||'.png');
  execute 'reset role';

  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  if exists(select 1 from public.site_content where id=draft_id) then
    raise exception 'Anonymous visitor can read draft';
  end if;
  if not exists(select 1 from public.site_content where id=live_id) then
    raise exception 'Published content missing for visitor';
  end if;
  snapshot := public.public_site_content();
  if not exists(select 1 from jsonb_array_elements(snapshot->'items') item where item->>'id'=live_id::text)
    or exists(select 1 from jsonb_array_elements(snapshot->'items') item where item->>'id'=draft_id::text) then
    raise exception 'Public snapshot publishing filter failed';
  end if;
  if (select count(*) from jsonb_object_keys(snapshot->'settings'))<>8 then raise exception 'Unexpected public settings fields'; end if;
  begin
    insert into public.site_content(kind,title) values('team','Public write');
    raise exception 'Anonymous insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.site_content set title='Public write' where id=live_id;
    raise exception 'Anonymous update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.site_content where id=live_id;
    raise exception 'Anonymous delete allowed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- A forged/nonmaster subject cannot use the real master's session.
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',gen_random_uuid(),'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() then raise exception 'Nonmaster authorized'; end if;
  if exists(select 1 from public.site_content where id=draft_id) then raise exception 'Nonmaster reads draft'; end if;
  begin
    insert into public.site_content(kind,title) values('team','Nonmaster write');
    raise exception 'Nonmaster insert allowed';
  exception when insufficient_privilege then null; end;
  update public.site_content set title='Nonmaster write' where id=live_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Nonmaster update allowed'; end if;
  delete from public.site_content where id=live_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Nonmaster delete allowed'; end if;
  update public.radio_settings set contact_text='Nonmaster write' where id=1;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Nonmaster contact update allowed'; end if;
  if exists(select 1 from storage.objects where id=object_id) then raise exception 'Nonmaster lists master assets'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('deluxe-content','team/'||gen_random_uuid()||'.png');
    raise exception 'Nonmaster storage upload allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata='{}'::jsonb where id=object_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Nonmaster storage update allowed'; end if;
  -- Storage also rejects direct SQL deletes at statement level; actual files must
  -- be removed through its API. Verify the role cannot get past that protection.
  begin
    delete from storage.objects where id=object_id;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'Nonmaster storage delete allowed'; end if;
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  delete from auth.sessions where id=sid;
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',master,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.admin_access() then raise exception 'Revoked master session authorized'; end if;
  update public.site_content set enabled=true where id=draft_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Revoked session publishes content'; end if;
  begin
    insert into public.site_content(kind,title) values('team','Revoked session write');
    raise exception 'Revoked session inserts content';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;

rollback;
select 'site content: master CRUD, public snapshot, contact/socials, RLS and storage passed; all QA changes rolled back' as result;
