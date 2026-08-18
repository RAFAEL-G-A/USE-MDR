-- Sessões administrativas independentes por dispositivo.
create table if not exists public.admin_verified_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, session_id)
);

create index if not exists admin_verified_sessions_expires_at_idx
  on public.admin_verified_sessions (expires_at);

alter table public.admin_verified_sessions enable row level security;
revoke all on table public.admin_verified_sessions from public, anon, authenticated;

comment on table public.admin_verified_sessions is
  'Autorizações administrativas independentes por sessão e dispositivo.';

-- Remove autorizações vencidas sempre que uma nova sessão é confirmada.
create or replace function public.cleanup_expired_admin_verified_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.admin_verified_sessions where expires_at <= now();
  return new;
end;
$$;

revoke all on function public.cleanup_expired_admin_verified_sessions() from public, anon, authenticated;

drop trigger if exists cleanup_expired_admin_verified_sessions_trigger
  on public.admin_verified_sessions;
create trigger cleanup_expired_admin_verified_sessions_trigger
before insert or update on public.admin_verified_sessions
for each statement execute function public.cleanup_expired_admin_verified_sessions();
