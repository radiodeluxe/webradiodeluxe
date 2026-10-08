create or replace function public.claim_news_import() returns jsonb language plpgsql security definer set search_path='' as $$
declare config public.news_automation; n int; h int; target int; run uuid;
begin
  select * into config from public.news_automation where id=1 for update;
  if not config.enabled then return jsonb_build_object('skip','Automação pausada'); end if;
  if config.locked_until>now() then return jsonb_build_object('skip','Importação em andamento'); end if;
  h := extract(hour from now() at time zone 'America/Sao_Paulo');
  target := case when h>=21 then 3 when h>=15 then 2 when h>=9 then 1 else 0 end;
  select coalesce(sum(published_count),0) into n from public.news_import_log where (finished_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
  if n>=target then return jsonb_build_object('skip','Meta do horário já atingida','today',n); end if;
  insert into public.news_import_log default values returning id into run;
  update public.news_automation set run_id=run,locked_until=now()+interval '3 minutes',last_run_at=now(),last_status='running' where id=1;
  return jsonb_build_object('run_id',run,'remaining',least(3-n,target-n));
end $$;
revoke all on function public.claim_news_import() from public, anon, authenticated;
grant execute on function public.claim_news_import() to service_role;

create or replace function public.finish_news_import(p_run uuid,p_articles jsonb,p_message text default null) returns integer language plpgsql security definer set search_path='' as $$
declare config public.news_automation; item jsonb; n int; inserted int:=0; changed int;
begin
  select * into config from public.news_automation where id=1 for update;
  if config.run_id is distinct from p_run or config.locked_until<now() then raise exception 'Invalid import lease'; end if;
  select coalesce(sum(published_count),0) into n from public.news_import_log where (finished_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
  if config.enabled then
    for item in select value from jsonb_array_elements(p_articles) loop
      exit when n+inserted>=3;
      insert into public.news_posts(title,body,source_url,source_name,source_author,source_published_at,origin,status,published_at,expires_at)
      values(left(item->>'title',240),'',item->>'url',left(item->>'source',120),left(item->>'author',160),(item->>'published')::timestamptz,'currents','published',now(),now()+interval '7 days')
      on conflict(source_url) do nothing;
      get diagnostics changed=row_count;
      inserted := inserted+changed;
    end loop;
  end if;
  update public.news_import_log set finished_at=now(),status=case when inserted>0 then 'success' else 'warning' end,published_count=inserted,message=left(coalesce(p_message,'Importação concluída'),400) where id=p_run;
  update public.news_automation set locked_until=null,run_id=null,last_status=case when inserted>0 then 'success' else 'warning' end,last_message=left(coalesce(p_message,'Importação concluída'),400) where id=1;
  return inserted;
end $$;
revoke all on function public.finish_news_import(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.finish_news_import(uuid,jsonb,text) to service_role;


-- After provisioning, every public or server-side account creation is disabled.
create or replace function private.restrict_auth_accounts() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Public accounts are disabled'; end $$;
create index news_import_day on public.news_import_log(finished_at);
create index votes_option on private.poll_votes(option_id);

