-- Applied migration snapshot. Do not reapply blindly.
insert into public.platform_plans(id,name,monthly_limit,monthly_price_try) values('free','Ücretsiz',25,0);
update public.platform_plans set monthly_limit=100 where id='starter';
update public.platform_plans set monthly_limit=150 where id='pro';
update public.platform_plans set monthly_limit=500 where id='business';
alter table public.account_access alter column plan_id set default 'free';
-- Preserve the private function's security and grants; change only the no-account fallback.
do $$ declare definition text; begin
definition:=pg_get_functiondef('aivora_private.admin_user_list(text,integer)'::regprocedure);
if position('coalesce(a.plan_id,''starter'')' in definition)=0 then raise exception 'Unexpected user list definition'; end if;
execute replace(definition,'coalesce(a.plan_id,''starter'')','coalesce(a.plan_id,''free'')');
end $$;
