begin;
do $$
declare u uuid; a uuid; r jsonb; rid uuid; c numeric;
begin
 if has_table_privilege('authenticated','public.platform_admins','insert') or has_table_privilege('anon','public.ai_usage_events','select') then raise exception 'Direct table access exposed'; end if;
 if has_function_privilege('authenticated','public.reserve_ai_request(uuid,uuid)','execute') or has_function_privilege('anon','public.admin_metrics()','execute') then raise exception 'RPC privilege exposed'; end if;
 if has_schema_privilege('authenticated','aivora_private','usage') then raise exception 'Private schema exposed'; end if;
 select user_id into u from public.platform_admins limit 1;
 select id into a from public.assistants where user_id=u limit 1;
 if u is null or a is null then raise exception 'Test fixture missing'; end if;
 update public.account_access set limit_override=1 where user_id=u;
 -- Isolate these tests from existing events; all changes are rolled back.
 update public.ai_usage_events set created_at=now()-interval '3 months' where user_id=u;
 r=public.reserve_ai_request(u,a);if not (r->>'ok')::boolean then raise exception 'Valid request rejected: %',r;end if;rid=(r->>'request_id')::uuid;
 r=public.reserve_ai_request(u,a);if r->>'code'<>'quota_exceeded' then raise exception 'Pending quota bypassed';end if;
 perform public.finish_ai_request(rid,'error',0,0,0,'test');
 r=public.reserve_ai_request(u,a);if not (r->>'ok')::boolean then raise exception 'Failure consumed quota';end if;rid=(r->>'request_id')::uuid;
 perform public.finish_ai_request(rid,'success',1000000,1000000,500000,null);
 select estimated_cost_usd into c from public.ai_usage_events where id=rid;
 if c<>1.85 then raise exception 'Cost arithmetic invalid: %',c;end if;
 if public.finish_ai_request(rid,'success',1,1,0,null) then raise exception 'Usage double finalized';end if;
 r=public.reserve_ai_request(u,a);if r->>'code'<>'quota_exceeded' then raise exception 'Success quota bypassed';end if;
 update public.account_access set limit_override=100,blocked=true where user_id=u;
 r=public.reserve_ai_request(u,a);if r->>'code'<>'account_paused' then raise exception 'Account pause bypassed';end if;
 update public.account_access set blocked=false where user_id=u;
 update public.platform_settings set chat_enabled=false;
 r=public.reserve_ai_request(u,a);if r->>'code'<>'maintenance' then raise exception 'Maintenance bypassed';end if;
 update public.platform_settings set chat_enabled=true;
 insert into public.assistant_controls values(a,true) on conflict(assistant_id) do update set blocked=true;
 r=public.reserve_ai_request(u,a);if r->>'code'<>'assistant_paused' then raise exception 'Assistant pause bypassed';end if;
 begin
  perform public.admin_apply_change((select id from auth.users where id<>u limit 1),'settings',null,'{"chat_enabled":false,"input_rate":0.4,"cached_rate":0.1,"output_rate":1.6}');
  raise exception 'Non-admin mutation accepted';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from pg_tables where schemaname='public' and tablename in ('platform_admins','platform_plans','platform_settings','account_access','assistant_controls','ai_usage_events','admin_audit_log') and not rowsecurity) then raise exception 'RLS missing';end if;
end $$;
rollback;
