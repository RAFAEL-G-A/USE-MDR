-- Execute este arquivo no SQL Editor do Supabase depois de criar sua conta
-- em Authentication > Users.
--
-- Antes de executar, substitua ADMIN_EMAIL_AQUI pelo e-mail exato da conta.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'ADMIN_EMAIL_AQUI';

alter table public.products enable row level security;

grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists "Catálogo público pode visualizar produtos" on public.products;
create policy "Catálogo público pode visualizar produtos"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "Administradora pode adicionar produtos" on public.products;
create policy "Administradora pode adicionar produtos"
on public.products
for insert
to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Administradora pode atualizar produtos" on public.products;
create policy "Administradora pode atualizar produtos"
on public.products
for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Administradora pode excluir produtos" on public.products;
create policy "Administradora pode excluir produtos"
on public.products
for delete
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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
)
with check (
  bucket_id = 'products'
  and (storage.foldername(name))[1] = 'catalog'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
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
);
