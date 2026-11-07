-- Applied after admin-schema.sql; service-only public invokers call narrow private definers.
create schema if not exists aivora_private;
revoke all on schema aivora_private from public,anon,authenticated;
grant usage on schema aivora_private to service_role;
alter function public.admin_user_list(text,integer) set schema aivora_private;
alter function aivora_private.admin_user_list(text,integer) security definer;
alter function public.admin_metrics() set schema aivora_private;
alter function aivora_private.admin_metrics() security definer;
revoke all on all functions in schema aivora_private from public,anon,authenticated;
grant execute on all functions in schema aivora_private to service_role;
create function public.admin_user_list(p_search text default '',p_offset integer default 0)
 returns jsonb language sql stable security invoker set search_path='' as $$ select aivora_private.admin_user_list(p_search,p_offset) $$;
create function public.admin_metrics() returns jsonb language sql stable security invoker set search_path='' as $$ select aivora_private.admin_metrics() $$;
revoke all on function public.admin_user_list(text,integer),public.admin_metrics() from public,anon,authenticated;
grant execute on function public.admin_user_list(text,integer),public.admin_metrics() to service_role;
