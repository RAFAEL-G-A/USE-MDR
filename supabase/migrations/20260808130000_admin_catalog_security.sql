create table if not exists public.admin_email_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_email_challenges_user_created_idx
on public.admin_email_challenges (user_id, created_at desc);

alter table public.admin_email_challenges enable row level security;
revoke all on table public.admin_email_challenges from anon, authenticated;

alter table public.products enable row level security;

grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists "Catalogo publico pode visualizar produtos" on public.products;
create policy "Catalogo publico pode visualizar produtos"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "Administradora pode adicionar produtos" on public.products;
create policy "Administradora pode adicionar produtos"
on public.products
for insert
to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);

drop policy if exists "Administradora pode atualizar produtos" on public.products;
create policy "Administradora pode atualizar produtos"
on public.products
for update
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);

drop policy if exists "Administradora pode excluir produtos" on public.products;
create policy "Administradora pode excluir produtos"
on public.products
for delete
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Administradora pode enviar imagens de produtos" on storage.objects;
create policy "Administradora pode enviar imagens de produtos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = 'catalog'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);

drop policy if exists "Administradora pode atualizar imagens de produtos" on storage.objects;
create policy "Administradora pode atualizar imagens de produtos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = 'catalog'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
)
with check (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = 'catalog'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);

drop policy if exists "Administradora pode excluir imagens de produtos" on storage.objects;
create policy "Administradora pode excluir imagens de produtos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = 'catalog'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_session_id')
    = (select auth.jwt() ->> 'session_id')
  and nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'inventory_email_verified_until'),
    ''
  )::timestamptz > now()
);
