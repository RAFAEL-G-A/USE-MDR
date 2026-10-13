create table if not exists public.admin_login_otp_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  provider_message_id text
);

create index if not exists admin_login_otp_requests_user_requested_idx
  on public.admin_login_otp_requests (user_id, requested_at desc);

alter table public.admin_login_otp_requests enable row level security;
revoke all on table public.admin_login_otp_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_login_otp_requests to service_role;

comment on table public.admin_login_otp_requests is
  'Controle privado de frequência dos códigos de login administrativo enviados pelo Resend.';
