-- Server-only integration tables. No token or mailbox access through client Data API.
create table public.gmail_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, tokens_cipher text not null, scopes text not null,
 updated_at timestamptz not null default now()
);
create table public.gmail_oauth_states (
 state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 verifier text not null, expires_at timestamptz not null
);
create index gmail_oauth_states_expiry on public.gmail_oauth_states(expires_at);
create table public.gmail_send_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 sender text not null, recipient text not null, subject text not null, body text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','unknown')),
 provider_id text, created_at timestamptz not null default now(), expires_at timestamptz not null,
 check(length(body) between 1 and 16000), check(length(subject) between 1 and 200)
);
create index gmail_send_reviews_owner on public.gmail_send_reviews(user_id,created_at);
alter table public.gmail_connections enable row level security;
alter table public.gmail_oauth_states enable row level security;
alter table public.gmail_send_reviews enable row level security;
revoke all on public.gmail_connections, public.gmail_oauth_states, public.gmail_send_reviews from public, anon, authenticated;
grant all on public.gmail_connections, public.gmail_oauth_states, public.gmail_send_reviews to service_role;
comment on table public.gmail_connections is 'Server-only encrypted Google OAuth tokens. Deliberately no client RLS policies.';
