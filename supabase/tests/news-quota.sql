begin;
do $$
declare claim jsonb; run uuid; n int;
begin
  -- Deleting an article must not free another publication slot that day.
  delete from public.news_posts where origin='currents';
  claim:=public.claim_news_import();
  if claim->>'skip' is null then raise exception 'Deleting news reset daily quota'; end if;
  -- Test the service-only finalizer against an overfilled request, then rollback.
  delete from public.news_import_log;
  update public.news_automation set enabled=true,run_id=null,locked_until=null where id=1;
  claim:=public.claim_news_import();
  if claim->>'run_id' is null then raise exception 'Run this quota QA after 09h Brasilia'; end if;
  run:=(claim->>'run_id')::uuid;
  begin
    perform public.finish_news_import(gen_random_uuid(),'[]'::jsonb,'Invalid lease QA');
    raise exception 'Invalid lease accepted';
  exception when others then if sqlerrm<>'Invalid import lease' then raise; end if;
  end;
  n:=public.finish_news_import(run,'[{"title":"Música QA 1","url":"https://example.com/qa1","source":"example.com","published":"2026-10-08T00:00:00Z"},{"title":"Música QA 2","url":"https://example.com/qa2","source":"example.com","published":"2026-10-08T00:00:00Z"},{"title":"Música QA 3","url":"https://example.com/qa3","source":"example.com","published":"2026-10-08T00:00:00Z"},{"title":"Música QA 4","url":"https://example.com/qa4","source":"example.com","published":"2026-10-08T00:00:00Z"}]'::jsonb,'QA cap');
  if n<>3 then raise exception 'Daily cap not enforced'; end if;
  claim:=public.claim_news_import();
  if claim->>'skip' is null then raise exception 'Repeat import acquired a new lease'; end if;
  if exists(select 1 from public.news_posts where body<>'' and origin='currents') then raise exception 'External article body retained'; end if;
end $$;
select 'PASS: daily quota survives deletion, import leases, repeated runs, maximum 3/day and no full article copies' as result;
rollback;
