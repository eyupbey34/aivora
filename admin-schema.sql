-- Admin data is accessible only to the authenticated server service role.
create table public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.platform_plans (
 id text primary key check(id ~ '^[a-z0-9_-]{1,30}$'), name text not null check(length(name) between 1 and 60),
 monthly_limit integer not null check(monthly_limit between 0 and 1000000)
);
insert into public.platform_plans values ('starter','Başlangıç',1000),('pro','Pro',10000),('business','İşletme',100000);
create table public.platform_settings (
 id boolean primary key default true check(id), chat_enabled boolean not null default true,
 input_rate numeric not null default 0.40 check(input_rate between 0 and 1000),
 cached_rate numeric not null default 0.10 check(cached_rate between 0 and 1000),
 output_rate numeric not null default 1.60 check(output_rate between 0 and 1000),
 tracking_started_at timestamptz not null default now()
);
insert into public.platform_settings(id) values(true);
create table public.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan_id text not null default 'starter' references public.platform_plans(id),
 limit_override integer check(limit_override between 0 and 1000000),
 blocked boolean not null default false, updated_at timestamptz not null default now()
);
insert into public.account_access(user_id) select id from auth.users;
create table public.assistant_controls (
 assistant_id uuid primary key references public.assistants(id) on delete cascade,
 blocked boolean not null default false
);
create table public.ai_usage_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 assistant_id uuid references public.assistants(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','success','error')),
 error_code text, input_tokens integer not null default 0 check(input_tokens>=0),
 output_tokens integer not null default 0 check(output_tokens>=0), cached_tokens integer not null default 0 check(cached_tokens>=0),
 estimated_cost_usd numeric not null default 0 check(estimated_cost_usd>=0),
 input_rate numeric not null, cached_rate numeric not null, output_rate numeric not null,
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index ai_usage_user_time on public.ai_usage_events(user_id,created_at desc);
create index ai_usage_time on public.ai_usage_events(created_at desc);
create table public.admin_audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id),
 action text not null, target_id text, changes jsonb not null default '{}', created_at timestamptz not null default now()
);
create index admin_audit_time on public.admin_audit_log(created_at desc);
alter table public.platform_admins enable row level security;
alter table public.platform_plans enable row level security;
alter table public.platform_settings enable row level security;
alter table public.account_access enable row level security;
alter table public.assistant_controls enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.platform_admins,public.platform_plans,public.platform_settings,public.account_access,public.assistant_controls,public.ai_usage_events,public.admin_audit_log from public,anon,authenticated;
grant all on public.platform_admins,public.platform_plans,public.platform_settings,public.account_access,public.assistant_controls,public.ai_usage_events,public.admin_audit_log to service_role;
-- Bootstrap only the verified existing owner. No role changes from the browser.
insert into public.platform_admins(user_id) select id from auth.users where lower(email)='maraslieyup75@gmail.com';

create function public.reserve_ai_request(p_user_id uuid,p_assistant_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.account_access; s public.platform_settings; lim integer; used integer; rid uuid;
begin
 insert into public.account_access(user_id) values(p_user_id) on conflict do nothing;
 select * into a from public.account_access where user_id=p_user_id for update;
 select * into s from public.platform_settings where id=true;
 if a.blocked then return jsonb_build_object('ok',false,'code','account_paused','message','Hesabının AI erişimi durduruldu.'); end if;
 if not s.chat_enabled then return jsonb_build_object('ok',false,'code','maintenance','message','AI sohbeti bakım için geçici olarak kapalı.'); end if;
 if not exists(select 1 from public.assistants where id=p_assistant_id and user_id=p_user_id) then
  return jsonb_build_object('ok',false,'code','assistant_missing','message','Asistan bulunamadı.'); end if;
 if exists(select 1 from public.assistant_controls where assistant_id=p_assistant_id and blocked) then
  return jsonb_build_object('ok',false,'code','assistant_paused','message','Bu asistanın AI erişimi durduruldu.'); end if;
 select coalesce(a.limit_override,p.monthly_limit) into lim from public.platform_plans p where p.id=a.plan_id;
 select count(*) into used from public.ai_usage_events where user_id=p_user_id
  and created_at >= (date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')
  and (status='success' or (status='pending' and created_at>now()-interval '2 minutes'));
 if used>=lim then return jsonb_build_object('ok',false,'code','quota_exceeded','message','Bu ayki mesaj limitin doldu.'); end if;
 if exists(select 1 from public.ai_usage_events where user_id=p_user_id and status='pending' and created_at>now()-interval '2 minutes') then
  return jsonb_build_object('ok',false,'code','request_pending','message','Önceki yanıtın tamamlanmasını bekle.'); end if;
 if (select count(*) from public.ai_usage_events where user_id=p_user_id and created_at>now()-interval '1 minute')>=10 then
  return jsonb_build_object('ok',false,'code','rate_limit','message','Çok hızlı mesaj gönderiyorsun. Bir dakika bekle.'); end if;
 insert into public.ai_usage_events(user_id,assistant_id,input_rate,cached_rate,output_rate)
 values(p_user_id,p_assistant_id,s.input_rate,s.cached_rate,s.output_rate) returning id into rid;
 return jsonb_build_object('ok',true,'request_id',rid,'limit',lim,'used',used);
end $$;

create function public.finish_ai_request(p_request_id uuid,p_status text,p_input integer default 0,p_output integer default 0,p_cached integer default 0,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_status not in ('success','error') or p_input<0 or p_output<0 or p_cached<0 or p_cached>p_input then raise exception 'Invalid usage'; end if;
 update public.ai_usage_events set status=p_status,input_tokens=p_input,output_tokens=p_output,cached_tokens=p_cached,
 estimated_cost_usd=((p_input-p_cached)*input_rate+p_cached*cached_rate+p_output*output_rate)/1000000,
 error_code=left(p_error,80),completed_at=now() where id=p_request_id and status='pending';
 get diagnostics n=row_count; return n=1;
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid), public.finish_ai_request(uuid,text,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid), public.finish_ai_request(uuid,text,integer,integer,integer,text) to service_role;

-- Atomic admin changes and their audit trail; actor membership is checked again in SQL.
create function public.admin_apply_change(p_actor uuid,p_action text,p_target text,p_changes jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_action='account' then
  if exists(select 1 from public.platform_admins where user_id=p_target::uuid) and (p_changes->>'blocked')::boolean then raise exception 'Admin account cannot be paused'; end if;
  insert into public.account_access(user_id,plan_id,limit_override,blocked)
  values(p_target::uuid,p_changes->>'plan_id',(p_changes->>'limit_override')::integer,(p_changes->>'blocked')::boolean)
  on conflict(user_id) do update set plan_id=excluded.plan_id,limit_override=excluded.limit_override,blocked=excluded.blocked,updated_at=now();
 elsif p_action='assistant' then
  insert into public.assistant_controls values(p_target::uuid,(p_changes->>'blocked')::boolean)
  on conflict(assistant_id) do update set blocked=excluded.blocked;
 elsif p_action='plan' then
  update public.platform_plans set name=p_changes->>'name',monthly_limit=(p_changes->>'monthly_limit')::integer where id=p_target;
  if not found then raise exception 'Plan missing'; end if;
 elsif p_action='settings' then
  update public.platform_settings set chat_enabled=(p_changes->>'chat_enabled')::boolean,
   input_rate=(p_changes->>'input_rate')::numeric,cached_rate=(p_changes->>'cached_rate')::numeric,output_rate=(p_changes->>'output_rate')::numeric where id=true;
 else raise exception 'Invalid action'; end if;
 insert into public.admin_audit_log(actor_id,action,target_id,changes) values(p_actor,p_action,p_target,p_changes);
 return true;
end $$;
revoke all on function public.admin_apply_change(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_apply_change(uuid,text,text,jsonb) to service_role;

-- Service-only summaries avoid exposing auth.users or allowing browser updates.
create function public.admin_user_list(p_search text default '',p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 with selected as (
 select u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at is not null as confirmed,
  coalesce(a.plan_id,'starter') as plan_id,a.limit_override,coalesce(a.blocked,false) as blocked,
  exists(select 1 from public.platform_admins x where x.user_id=u.id) as is_admin,
  (select count(*) from public.assistants t where t.user_id=u.id) as assistant_count,
  (select count(*) from public.ai_usage_events e where e.user_id=u.id and status='success' and created_at >= (date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')) as month_messages
 from auth.users u left join public.account_access a on a.user_id=u.id
 where u.email ilike '%'||left(p_search,100)||'%' order by u.created_at desc limit 30 offset greatest(0,least(p_offset,100000))
 ) select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(selected)) from selected),'[]'::jsonb),'total',(select count(*) from auth.users where email ilike '%'||left(p_search,100)||'%'));
$$;
revoke all on function public.admin_user_list(text,integer) from public,anon,authenticated;
grant execute on function public.admin_user_list(text,integer) to service_role;

create function public.admin_metrics() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'users',(select count(*) from auth.users), 'assistants',(select count(*) from public.assistants),
 'month_messages',(select count(*) from public.ai_usage_events where status='success' and created_at >= (date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')),
 'month_cost',(select coalesce(sum(estimated_cost_usd),0) from public.ai_usage_events where created_at >= (date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')),
 'month_tokens',(select coalesce(sum(input_tokens+output_tokens),0) from public.ai_usage_events where created_at >= (date_trunc('month',now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul')),
 'day_errors',(select count(*) from public.ai_usage_events where status='error' and created_at>now()-interval '24 hours'),
 'daily',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from (select (created_at at time zone 'Europe/Istanbul')::date as day,count(*) filter(where status='success') as messages,count(*) filter(where status='error') as errors from public.ai_usage_events where created_at>now()-interval '7 days' group by 1 order by 1) d)
);
$$;
revoke all on function public.admin_metrics() from public,anon,authenticated;
grant execute on function public.admin_metrics() to service_role;
-- Trigger functions have no direct client use; triggers continue to execute normally.
revoke execute on function public.handle_new_user(),public.rls_auto_enable() from public,anon,authenticated;
