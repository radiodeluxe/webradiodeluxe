create or replace function public.manage_poll(p_id uuid,p_question text,p_options text[],p_status text,p_ends_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_poll_id uuid; votes int; label text; position int:=0;
begin
 if not private.is_master() then raise exception 'Master access required' using errcode='42501'; end if;
 if p_options is null or cardinality(p_options) not between 2 and 6 or array_position(p_options,null) is not null then raise exception 'Choose 2 to 6 options'; end if;
 if exists(select 1 from unnest(p_options) as choice where length(trim(choice)) not between 1 and 100) or (select count(distinct lower(trim(choice))) from unnest(p_options) as choice)<>cardinality(p_options) then raise exception 'Options must be distinct and nonempty'; end if;
 if p_ends_at is not null and p_status='active' and p_ends_at<=now() then raise exception 'End date must be in the future'; end if;
 if p_status='active' then update public.polls set status='closed' where status='active' and (p_id is null or id<>p_id); end if;
 if p_id is null then insert into public.polls(question,status,ends_at) values(trim(p_question),p_status,p_ends_at) returning id into v_poll_id;
 else
   select id into v_poll_id from public.polls where id=p_id for update;
   if v_poll_id is null then raise exception 'Poll not found'; end if;
   update public.polls set question=trim(p_question),status=p_status,ends_at=p_ends_at where id=p_id;
 end if;
 select count(*) into votes from private.poll_votes where private.poll_votes.poll_id=v_poll_id;
 if votes>0 then
   if p_options is distinct from (select array_agg(o.label order by o.position) from public.poll_options o where o.poll_id=v_poll_id) then raise exception 'Options cannot change after voting'; end if;
 else
   delete from public.poll_options o where o.poll_id=v_poll_id;
   foreach label in array p_options loop
     insert into public.poll_options(poll_id,label,position) values(v_poll_id,trim(label),position);
     position:=position+1;
   end loop;
 end if;
 return v_poll_id;
end $$;
revoke all on function public.manage_poll(uuid,text,text[],text,timestamptz) from public,anon;
grant execute on function public.manage_poll(uuid,text,text[],text,timestamptz) to authenticated;


