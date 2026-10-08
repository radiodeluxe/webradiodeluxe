create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

-- Only provisioned masters may be created. Public signup cannot set app_metadata.
create function private.restrict_auth_accounts() returns trigger language plpgsql set search_path = '' as $$
begin
  if lower(new.email) <> 'cesarideadigital@gmail.com' or coalesce(new.raw_app_meta_data->>'role','') <> 'master' then
    raise exception 'Public accounts are disabled';
  end if;
  return new;
end $$;
revoke all on function private.restrict_auth_accounts() from public, anon, authenticated;
create trigger deluxe_restrict_accounts before insert on auth.users for each row execute function private.restrict_auth_accounts();

create function private.is_master() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.admin_users a where a.user_id = (select auth.uid()))
    and exists(select 1 from auth.sessions s where s.id::text = (select auth.jwt()->>'session_id') and s.user_id = (select auth.uid()));
$$;
revoke all on function private.is_master() from public, anon;
grant execute on function private.is_master() to authenticated;
create function public.admin_access() returns boolean language sql stable set search_path = '' as $$ select private.is_master(); $$;
revoke all on function public.admin_access() from public, anon;
grant execute on function public.admin_access() to authenticated;

grant update on public.radio_settings to authenticated;
create policy "Master updates radio" on public.radio_settings for update to authenticated using ((select private.is_master())) with check ((select private.is_master()));
grant select, delete on public.newsletter_subscribers to authenticated;
create policy "Master reads subscriptions" on public.newsletter_subscribers for select to authenticated using ((select private.is_master()));
create policy "Master removes subscriptions" on public.newsletter_subscribers for delete to authenticated using ((select private.is_master()));

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 240),
  body text not null default '' check(length(body) <= 20000),
  category text not null default 'Música' check(length(category) between 1 and 60),
  image_url text check(image_url is null or image_url ~ '^https://'),
  source_url text unique check(source_url is null or source_url ~ '^https://'),
  source_name text,
  source_author text,
  source_published_at timestamptz,
  origin text not null default 'manual' check(origin in ('manual','currents')),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.news_posts enable row level security;
revoke all on public.news_posts from anon, authenticated;
grant select on public.news_posts to anon, authenticated;
grant insert, update, delete on public.news_posts to authenticated;
create policy "Published news" on public.news_posts for select to anon, authenticated using (status='published' and published_at<=now() and (expires_at is null or expires_at>now()));
create policy "Master manages news" on public.news_posts for all to authenticated using ((select private.is_master())) with check ((select private.is_master()));
create index news_publication on public.news_posts(published_at desc) where status='published';

create table public.news_automation (
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default true,
  daily_limit smallint not null default 3 check(daily_limit=3),
  timezone text not null default 'America/Sao_Paulo' check(timezone='America/Sao_Paulo'),
  run_id uuid,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_message text
);
insert into public.news_automation(id) values(1);
alter table public.news_automation enable row level security;
revoke all on public.news_automation from anon, authenticated;
grant select, update(enabled) on public.news_automation to authenticated;
create policy "Master manages automation" on public.news_automation for all to authenticated using ((select private.is_master())) with check ((select private.is_master()));
create table public.news_import_log (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  published_count integer not null default 0,
  message text
);
alter table public.news_import_log enable row level security;
revoke all on public.news_import_log from anon, authenticated;
grant select on public.news_import_log to authenticated;
create policy "Master reads import logs" on public.news_import_log for select to authenticated using ((select private.is_master()));

-- Service-only access to encrypted credentials. No credentials are shipped in migrations.
create function public.news_credentials() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('deluxe_currents_key','deluxe_cron_token');
$$;
revoke all on function public.news_credentials() from public, anon, authenticated;
grant execute on function public.news_credentials() to service_role;

create function public.claim_news_import() returns jsonb language plpgsql security definer set search_path='' as $$
declare config public.news_automation; n int; h int; target int; run uuid;
begin
  select * into config from public.news_automation where id=1 for update;
  if not config.enabled then return jsonb_build_object('skip','Automação pausada'); end if;
  if config.locked_until>now() then return jsonb_build_object('skip','Importação em andamento'); end if;
  h := extract(hour from now() at time zone 'America/Sao_Paulo');
  target := case when h>=21 then 3 when h>=15 then 2 when h>=9 then 1 else 0 end;
  select count(*) into n from public.news_posts where origin='currents' and (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
  if n>=target then return jsonb_build_object('skip','Meta do horário já atingida','today',n); end if;
  insert into public.news_import_log default values returning id into run;
  update public.news_automation set run_id=run,locked_until=now()+interval '3 minutes',last_run_at=now(),last_status='running' where id=1;
  return jsonb_build_object('run_id',run,'remaining',least(3-n,target-n));
end $$;
revoke all on function public.claim_news_import() from public, anon, authenticated;
grant execute on function public.claim_news_import() to service_role;

create function public.finish_news_import(p_run uuid,p_articles jsonb,p_message text default null) returns integer language plpgsql security definer set search_path='' as $$
declare config public.news_automation; item jsonb; n int; inserted int:=0; changed int;
begin
  select * into config from public.news_automation where id=1 for update;
  if config.run_id is distinct from p_run or config.locked_until<now() then raise exception 'Invalid import lease'; end if;
  select count(*) into n from public.news_posts where origin='currents' and (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
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

create table public.polls (
 id uuid primary key default gen_random_uuid(), question text not null check(length(question) between 5 and 180),
 status text not null default 'draft' check(status in ('draft','active','closed')),
 ends_at timestamptz, created_at timestamptz not null default now()
);
create unique index one_active_poll on public.polls(status) where status='active';
create table public.poll_options (
 id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.polls(id) on delete cascade,
 label text not null check(length(label) between 1 and 100), position smallint not null,
 unique(poll_id,position),unique(poll_id,id)
);
create table private.poll_votes (
 poll_id uuid not null, option_id uuid not null, voter_hash text not null, ip_hash text not null,created_at timestamptz not null default now(),
 primary key(poll_id,voter_hash),foreign key(poll_id,option_id) references public.poll_options(poll_id,id)
);
create index votes_ip_time on private.poll_votes(ip_hash,created_at);
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table private.poll_votes enable row level security;
revoke all on public.polls,public.poll_options,private.poll_votes from public,anon,authenticated;
grant select on public.polls,public.poll_options to authenticated;
create policy "Master reads polls" on public.polls for select to authenticated using ((select private.is_master()));
create policy "Master reads options" on public.poll_options for select to authenticated using ((select private.is_master()));

create function public.poll_results(p_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'question',p.question,'status',p.status,'ends_at',p.ends_at,'total',(select count(*) from private.poll_votes v where v.poll_id=p.id),
 'options',(select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'votes',(select count(*) from private.poll_votes v where v.option_id=o.id)) order by o.position) from public.poll_options o where o.poll_id=p.id))
 from public.polls p where ((p_id is null and p.status='active' and (p.ends_at is null or p.ends_at>now())) or (p_id=p.id and (p.status in ('active','closed') or private.is_master()))) limit 1;
$$;
revoke all on function public.poll_results(uuid) from public;
grant execute on function public.poll_results(uuid) to anon,authenticated;

create function public.manage_poll(p_id uuid,p_question text,p_options text[],p_status text,p_ends_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare poll_id uuid; votes int; label text; position int:=0;
begin
 if not private.is_master() then raise exception 'Master access required' using errcode='42501'; end if;
 if cardinality(p_options) not between 2 and 6 or array_position(p_options,null) is not null then raise exception 'Choose 2 to 6 options'; end if;
 if p_ends_at is not null and p_status='active' and p_ends_at<=now() then raise exception 'End date must be in the future'; end if;
 if p_status='active' then update public.polls set status='closed' where status='active' and (p_id is null or id<>p_id); end if;
 if p_id is null then insert into public.polls(question,status,ends_at) values(trim(p_question),p_status,p_ends_at) returning id into poll_id;
 else
   select id into poll_id from public.polls where id=p_id for update;
   if poll_id is null then raise exception 'Poll not found'; end if;
   update public.polls set question=trim(p_question),status=p_status,ends_at=p_ends_at where id=p_id;
 end if;
 select count(*) into votes from private.poll_votes where private.poll_votes.poll_id=manage_poll.poll_id;
 if votes>0 then
   if p_options is distinct from (select array_agg(o.label order by o.position) from public.poll_options o where o.poll_id=manage_poll.poll_id) then raise exception 'Options cannot change after voting'; end if;
 else
   delete from public.poll_options o where o.poll_id=manage_poll.poll_id;
   foreach label in array p_options loop
     insert into public.poll_options(poll_id,label,position) values(poll_id,trim(label),position);
     position:=position+1;
   end loop;
 end if;
 return poll_id;
end $$;
revoke all on function public.manage_poll(uuid,text,text[],text,timestamptz) from public,anon;
grant execute on function public.manage_poll(uuid,text,text[],text,timestamptz) to authenticated;

-- Only the same-origin vote API knows this secret; browsers cannot write votes via REST.
create function public.cast_listener_vote(p_poll uuid,p_option uuid,p_voter text,p_ip text,p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.polls; secret text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='deluxe_poll_secret';
 if secret is null or p_secret is distinct from secret then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_voter !~ '^[a-f0-9]{64}$' or p_ip !~ '^[a-f0-9]{64}$' then raise exception 'Invalid voter'; end if;
 select * into p from public.polls where id=p_poll for update;
 if p.id is null or p.status<>'active' or p.ends_at<=now() then raise exception 'Poll closed'; end if;
 if exists(select 1 from private.poll_votes where poll_id=p_poll and voter_hash=p_voter) then return jsonb_build_object('already_voted',true,'results',public.poll_results(p_poll)); end if;
 if (select count(*) from private.poll_votes where ip_hash=p_ip and created_at>now()-interval '1 hour')>=20 then raise exception 'Vote rate limit'; end if;
 insert into private.poll_votes(poll_id,option_id,voter_hash,ip_hash) values(p_poll,p_option,p_voter,p_ip);
 return jsonb_build_object('already_voted',false,'results',public.poll_results(p_poll));
end $$;
revoke all on function public.cast_listener_vote(uuid,uuid,text,text,text) from public,authenticated;
grant execute on function public.cast_listener_vote(uuid,uuid,text,text,text) to anon;

create function private.enqueue_music_news() returns bigint language plpgsql security definer set search_path='' as $$
declare token text; ref text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='deluxe_cron_token';
 select decrypted_secret into ref from vault.decrypted_secrets where name='deluxe_project_url';
 if token is null or ref is null then raise exception 'News credentials not configured'; end if;
 return net.http_post(url:=ref||'/functions/v1/music-news',headers:=jsonb_build_object('Content-Type','application/json','x-deluxe-cron',token),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function private.enqueue_music_news() from public,anon,authenticated;
select cron.schedule('deluxe-music-news','0 0,1,12,13,18,19 * * *','select private.enqueue_music_news();');
select cron.schedule('deluxe-expire-news','15 3 * * *',$cron$delete from public.news_posts where origin='currents' and expires_at<=now(); delete from public.news_import_log where started_at<now()-interval '30 days';$cron$);

-- Initial editorial poll, with no fake votes.
with new_poll as (insert into public.polls(question,status) values('Qual estilo você quer ouvir mais na Deluxe?','active') returning id)
insert into public.poll_options(poll_id,label,position) select id,choice,position from new_poll cross join (values('Rap nacional',0),('Rap internacional',1),('Trap & new school',2),('Clássicos / boom bap',3)) as options(choice,position);
