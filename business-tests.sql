begin;
-- Disposable rows are rolled back, even if all checks pass.
insert into public.business_contacts(id,user_id,name) values('10000000-0000-0000-0000-000000000001','dd6d2eec-ecb0-4306-98bf-04011b652592','Aivora security fixture'),('10000000-0000-0000-0000-000000000002','47859530-4959-48b1-b8e2-e8c64510257b','Other account fixture');
insert into public.business_appointments(id,user_id,title,starts_at,ends_at) values('20000000-0000-0000-0000-000000000001','dd6d2eec-ecb0-4306-98bf-04011b652592','Overlap fixture','2030-01-01T10:00:00+03','2030-01-01T11:00:00+03');
select set_config('request.jwt.claims','{"sub":"dd6d2eec-ecb0-4306-98bf-04011b652592","role":"authenticated"}',true);
set local role authenticated;
do $$ declare c int; begin
 select count(*) into c from public.business_contacts where id in('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
 if c<>1 then raise exception 'FAIL owner isolation'; end if;
 begin
 insert into public.business_contacts(user_id,name) values('47859530-4959-48b1-b8e2-e8c64510257b','Forbidden');
 raise exception 'FAIL foreign insert';
 exception when insufficient_privilege then null; end;
 begin
 update public.business_contacts set user_id='47859530-4959-48b1-b8e2-e8c64510257b' where id='10000000-0000-0000-0000-000000000001';
 raise exception 'FAIL owner reassignment';
 exception when insufficient_privilege then null; end;
 update public.business_contacts set name='Invisible' where id='10000000-0000-0000-0000-000000000002';
 if found then raise exception 'FAIL foreign update'; end if;
 begin
 insert into public.business_appointments(user_id,title,starts_at,ends_at) values('dd6d2eec-ecb0-4306-98bf-04011b652592','Overlap','2030-01-01T10:30:00+03','2030-01-01T11:30:00+03');
 raise exception 'FAIL overlap accepted';
 exception when raise_exception then if sqlerrm not like 'Bu saat aralığında%' then raise; end if; end;
 insert into public.business_appointments(user_id,title,starts_at,ends_at) values('dd6d2eec-ecb0-4306-98bf-04011b652592','Adjacent valid','2030-01-01T11:00:00+03','2030-01-01T12:00:00+03');
 begin
 insert into public.business_appointments(user_id,contact_id,title,starts_at,ends_at) values('dd6d2eec-ecb0-4306-98bf-04011b652592','10000000-0000-0000-0000-000000000002','Foreign contact','2030-02-01T10:00:00+03','2030-02-01T11:00:00+03');
 raise exception 'FAIL cross account FK';
 exception when foreign_key_violation then null; end;
 if has_table_privilege('authenticated','public.business_messages','INSERT') then raise exception 'FAIL fabricated messages'; end if;
 if has_table_privilege('anon','public.business_contacts','SELECT') then raise exception 'FAIL anonymous read'; end if;
 if has_column_privilege('authenticated','public.business_conversations','assistant_id','UPDATE') then raise exception 'FAIL thread reassignment'; end if;
 if has_function_privilege('authenticated','public.save_ai_exchange(uuid,uuid,uuid,text,text)','EXECUTE') then raise exception 'FAIL service function client callable'; end if;
end $$;
reset role;
select 'PASS: owner isolation, ownership reassignment, foreign writes, overlap prevention, adjacent booking, cross-account relationship, service-only messages and RPC' as result;
rollback;
