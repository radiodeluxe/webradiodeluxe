-- Executes against the configured Deluxe project; all QA rows and changes roll back.
begin;
do $$
declare master uuid; sid uuid:=gen_random_uuid(); pid uuid; oid uuid; secret text; result jsonb; affected integer;
begin
 select user_id into master from private.admin_users;
 if master is null then raise exception 'Master must be provisioned first'; end if;
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(sid,master,now(),now(),'aal1');
 select decrypted_secret into secret from vault.decrypted_secrets where name='deluxe_poll_secret';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 if public.admin_access() is not true then raise exception 'Valid master denied'; end if;
 pid:=public.manage_poll(null,'Enquete temporária de QA',array['Opção A','Opção B'],'active',null);
 if (select count(*) from public.polls where status='active')<>1 then raise exception 'Multiple active polls'; end if;
 insert into public.news_posts(title,status,published_at) values('Publicação temporária de QA','draft',null);
 update public.radio_settings set contact_email=contact_email where id=1;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Master radio update denied'; end if;
 execute 'reset role';
 select id into oid from public.poll_options where poll_id=pid order by position limit 1;
 execute 'set local role anon';
 if has_table_privilege('anon','public.newsletter_subscribers','select') then raise exception 'Subscriber list exposed'; end if;
 if has_table_privilege('anon','public.news_posts','insert') then raise exception 'Public news insertion allowed'; end if;
 if has_function_privilege('anon','public.news_credentials()','execute') then raise exception 'Secrets exposed'; end if;
 if exists(select 1 from public.news_posts where title='Publicação temporária de QA') then raise exception 'Draft exposed'; end if;
 begin
   perform public.cast_listener_vote(pid,oid,repeat('a',64),repeat('b',64),'incorrect');
   raise exception 'Missing secret accepted';
 exception when insufficient_privilege then null;
 end;
 result:=public.cast_listener_vote(pid,oid,repeat('a',64),repeat('b',64),secret);
 if (result->'results'->>'total')::int<>1 then raise exception 'Vote not counted'; end if;
 result:=public.cast_listener_vote(pid,oid,repeat('a',64),repeat('b',64),secret);
 if (result->>'already_voted')::boolean is not true or (result->'results'->>'total')::int<>1 then raise exception 'Duplicate vote counted'; end if;
 execute 'reset role';
 execute 'set local role authenticated';
 begin
   perform public.manage_poll(pid,'Enquete temporária de QA',array['Alterada','Opção B'],'active',null);
   raise exception 'Options changed after voting';
 exception when others then if sqlerrm<>'Options cannot change after voting' then raise; end if;
 end;
 perform public.manage_poll(pid,'Enquete temporária de QA',array['Opção A','Opção B'],'closed',null);
 execute 'reset role';
 execute 'set local role anon';
 begin
   perform public.cast_listener_vote(pid,oid,repeat('c',64),repeat('b',64),secret);
   raise exception 'Closed poll accepted vote';
 exception when others then if sqlerrm<>'Poll closed' then raise; end if;
 end;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 if public.admin_access() is true then raise exception 'Nonmaster authorized'; end if;
 if exists(select 1 from public.news_automation) then raise exception 'Automation exposed to nonmaster'; end if;
 begin
   perform public.manage_poll(null,'Unauthorized poll',array['A','B'],'draft',null);
   raise exception 'Nonmaster managed polls';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
 delete from auth.sessions where id=sid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 if public.admin_access() is true then raise exception 'Revoked session authorized'; end if;
 update public.radio_settings set contact_email='qa@example.com' where id=1;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Revoked session wrote radio'; end if;
 execute 'reset role';
end $$;
select 'PASS: master, nonmaster, revoked sessions, draft privacy, votes, duplicate prevention, closed polls, and immutable options' as result;
rollback;
