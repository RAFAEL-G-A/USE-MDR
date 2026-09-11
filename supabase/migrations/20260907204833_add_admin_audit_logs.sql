-- Auditoria administrativa interna. A tabela não é exposta a clientes públicos;
-- somente Edge Functions autenticadas escrevem nela usando o service role.

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  request_id text,
  action text not null check (char_length(action) between 1 and 80),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text check (resource_id is null or char_length(resource_id) between 1 and 200),
  result text not null check (result in ('success', 'failure')),
  metadata jsonb not null default '{}'::jsonb,
  constraint admin_audit_logs_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint admin_audit_logs_metadata_size_check check (octet_length(metadata::text) <= 8192)
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_user_created_at_idx
  on public.admin_audit_logs (user_id, created_at desc);

create index if not exists admin_audit_logs_action_created_at_idx
  on public.admin_audit_logs (action, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from public, anon, authenticated;
grant select, insert on table public.admin_audit_logs to service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;

comment on table public.admin_audit_logs is
  'Registro interno e não bloqueante de ações administrativas críticas.';
