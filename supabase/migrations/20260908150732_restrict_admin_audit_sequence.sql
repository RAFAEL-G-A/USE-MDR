-- A sequence identity recebe privilégios de PUBLIC por padrão no PostgreSQL.
-- A auditoria administrativa deve permanecer acessível somente ao service role.

revoke all on sequence public.admin_audit_logs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;
