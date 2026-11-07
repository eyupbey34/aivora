-- Aivora business workspace: owner-scoped records; no external messages are sent.
create table public.business_contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40),
 company text not null default '' check(length(company)<=100), stage text not null default 'new' check(stage in('new','qualified','customer','closed')),
 notes text not null default '' check(length(notes)<=4000), archived boolean not null default false, created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.business_appointments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 contact_id uuid, title text not null check(length(trim(title)) between 1 and 160), starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in('scheduled','completed','cancelled')), notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), check(ends_at>starts_at and ends_at<=starts_at+interval '1 day'),
 foreign key(contact_id,user_id) references public.business_contacts(id,user_id)
);
create table public.business_knowledge (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120), content text not null check(length(trim(content)) between 1 and 6000),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.business_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), due_at timestamptz,
 status text not null default 'open' check(status in('open','done','archived')), notes text not null default '' check(length(notes)<=4000), created_at timestamptz not null default now()
);
create table public.business_drafts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), channel text not null check(channel in('email','social','ads','campaign')),
 content text not null check(length(trim(content)) between 1 and 8000), status text not null default 'draft' check(status in('draft','approved','archived')), created_at timestamptz not null default now()
);
create table public.business_profile (
 user_id uuid primary key references auth.users(id) on delete cascade,
 business_name text not null default 'Aivora' check(length(business_name) between 1 and 100), hours text not null default '' check(length(hours)<=1000),
 language text not null default 'Türkçe' check(length(language)<=60), tone text not null default 'Samimi ve profesyonel' check(length(tone)<=200),
 description text not null default '' check(length(description)<=3000)
);
create table public.business_conversations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 assistant_id uuid not null references public.assistants(id),title text not null check(length(title)<=120),
 status text not null default 'open' check(status in('open','closed')), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id)
);
create table public.business_messages (
 id uuid primary key default gen_random_uuid(), ordinal bigint generated always as identity, user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,role text not null check(role in('user','assistant')), content text not null check(length(content)<=12000),
 created_at timestamptz not null default now(),foreign key(conversation_id,user_id) references public.business_conversations(id,user_id)
);
do $$ declare t text; begin
 foreach t in array array['business_contacts','business_appointments','business_knowledge','business_tasks','business_drafts','business_profile','business_conversations','business_messages'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using((select auth.uid())=user_id)',t);
 execute format('create index %I on public.%I(user_id)',t||'_owner',t);
 if t not in('business_conversations','business_messages') then
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check((select auth.uid())=user_id)',t);
 execute format('create policy own_update on public.%I for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id)',t);
 end if;
 end loop;
end $$;
grant update(status) on public.business_conversations to authenticated;
create policy own_status on public.business_conversations for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index business_messages_thread on public.business_messages(conversation_id,created_at);
create index business_conversations_assistant on public.business_conversations(assistant_id);
create index business_appointments_contact on public.business_appointments(contact_id,user_id);
create index business_appointments_time on public.business_appointments(user_id,starts_at);
create function public.check_appointment_overlap() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is not null and (select auth.uid())<>new.user_id then raise exception 'Forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if new.status='scheduled' and exists(select 1 from public.business_appointments a where a.user_id=new.user_id and a.id<>new.id and a.status='scheduled' and a.starts_at<new.ends_at and a.ends_at>new.starts_at) then raise exception 'Bu saat aralığında başka bir randevu var.'; end if;
 return new;
end $$;
revoke all on function public.check_appointment_overlap() from public,anon,authenticated;
create trigger appointment_no_overlap before insert or update on public.business_appointments for each row execute function public.check_appointment_overlap();
create function public.save_ai_exchange(p_user uuid,p_assistant uuid,p_conversation uuid,p_question text,p_reply text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; begin
 if not exists(select 1 from public.assistants where id=p_assistant and user_id=p_user) then raise exception 'Assistant ownership'; end if;
 if p_conversation is null then
 insert into public.business_conversations(user_id,assistant_id,title) values(p_user,p_assistant,left(p_question,120)) returning id into v_id;
 else
 select id into v_id from public.business_conversations where id=p_conversation and user_id=p_user and assistant_id=p_assistant and status='open' for update;
 if v_id is null then raise exception 'Conversation ownership'; end if;
 update public.business_conversations set updated_at=now() where id=v_id;
 end if;
 insert into public.business_messages(user_id,conversation_id,role,content) values(p_user,v_id,'user',p_question),(p_user,v_id,'assistant',p_reply);
 return v_id;
end $$;
revoke all on function public.save_ai_exchange(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_ai_exchange(uuid,uuid,uuid,text,text) to service_role;

grant usage,select on sequence public.business_messages_ordinal_seq to service_role;
