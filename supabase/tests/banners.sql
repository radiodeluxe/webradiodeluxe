-- Real permission checks; all changes and the temporary master session roll back.
begin;
do $$
declare master uuid; sid uuid:=gen_random_uuid(); affected int;
begin
 select user_id into master from private.admin_users;
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(sid,master,now(),now(),'aal1');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 update public.ad_banners set enabled=false,title='QA banner privado' where id='top';
 get diagnostics affected=row_count;
 if affected<>1 or (select count(*) from public.ad_banners)<>3 then raise exception 'Master banner access failed'; end if;
 execute 'reset role';
 execute 'set local role anon';
 if exists(select 1 from public.ad_banners where id='top') then raise exception 'Disabled banner exposed'; end if;
 begin
   update public.ad_banners set title='Unauthorized' where id='main';
   raise exception 'Anonymous write allowed';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','session_id',gen_random_uuid())::text,true);
 execute 'set local role authenticated';
 update public.ad_banners set title='Unauthorized' where id='main';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Non-master write allowed'; end if;
 if exists(select 1 from public.ad_banners where id='top') then raise exception 'Non-master reads disabled banner'; end if;
 execute 'reset role';
 delete from auth.sessions where id=sid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 update public.ad_banners set enabled=true where id='top';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Revoked master session allowed'; end if;
 execute 'reset role';
 if not exists(select 1 from storage.buckets where id='deluxe-banners' and public and file_size_limit=5242880 and not ('image/svg+xml'=any(allowed_mime_types))) then raise exception 'Storage restrictions missing'; end if;
end $$;
rollback;
select 'banner permissions passed; changes rolled back' as result;
