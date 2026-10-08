begin;
set local role anon;
select id from public.radio_settings where id = 1;
insert into public.newsletter_subscribers (email, consent) values ('layout-privacy-test@example.invalid', true);
do $$
begin
  begin
    perform email from public.newsletter_subscribers;
    raise exception 'FAIL: anon can read subscriber emails';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.radio_settings set stream_url = 'https://example.invalid/radio' where id = 1;
    raise exception 'FAIL: anon can change settings';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.newsletter_subscribers (email, consent) values ('no-consent@example.invalid', false);
    raise exception 'FAIL: newsletter accepts absent consent';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    update public.newsletter_subscribers set email = 'changed@example.invalid';
    raise exception 'FAIL: anon can update newsletter';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.newsletter_subscribers;
    raise exception 'FAIL: anon can delete subscribers';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;
do $$
begin
  begin
    perform email from public.newsletter_subscribers;
    raise exception 'FAIL: unrelated signed-in user can read subscriber emails';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.radio_settings set stream_url = 'https://example.invalid/radio' where id = 1;
    raise exception 'FAIL: unrelated signed-in user can change settings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: settings public read; newsletter consent-only insert; newsletter read/update/delete denied; settings mutation denied; test rows rolled back' as result;
