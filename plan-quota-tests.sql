-- Quota boundary checks; all fixture changes roll back.
begin;
do $$
declare u uuid; a uuid; p record; r jsonb; rid uuid;
begin
select user_id into u from public.platform_admins limit 1;
select id into a from public.assistants where user_id=u limit 1;
if u is null or a is null then raise exception 'Test fixture missing'; end if;
update public.ai_usage_events set created_at=now()-interval '3 months' where user_id=u;
for p in select id,monthly_limit from public.platform_plans order by monthly_limit loop
update public.account_access set plan_id=p.id,limit_override=null,blocked=false where user_id=u;
r:=public.reserve_ai_request(u,a);
if not coalesce((r->>'ok')::boolean,false) or (r->>'limit')::integer<>p.monthly_limit then raise exception 'Plan limit mismatch for %: %',p.id,r; end if;
rid:=(r->>'request_id')::uuid;
perform public.finish_ai_request(rid,'success',0,0,0,null);
insert into public.ai_usage_events(user_id,assistant_id,status,input_rate,cached_rate,output_rate)
select u,a,'success',0,0,0 from generate_series(1,p.monthly_limit-1);
r:=public.reserve_ai_request(u,a);
if r->>'code' is distinct from 'quota_exceeded' then raise exception 'Quota bypass for %: %',p.id,r; end if;
update public.ai_usage_events set created_at=now()-interval '3 months' where user_id=u;
end loop;
end $$;
rollback;
