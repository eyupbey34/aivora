-- Applied migration snapshot: set_membership_monthly_try_prices. Do not reapply blindly.
alter table public.platform_plans add column monthly_price_try integer check (monthly_price_try between 0 and 1000000);
update public.platform_plans set name='Başlangıç',monthly_price_try=150 where id='starter';
update public.platform_plans set name='Plus',monthly_price_try=250 where id='pro';
update public.platform_plans set name='Pro',monthly_price_try=500 where id='business';
