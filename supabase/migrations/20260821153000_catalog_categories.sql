create table if not exists public.catalog_categories (
  category_key text primary key,
  name text not null,
  description text not null default '',
  image_url text,
  image_path text,
  sort_order smallint not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_categories_name_unique
on public.catalog_categories (lower(name));

create table if not exists public.catalog_subcategories (
  id bigint generated always as identity primary key,
  category_key text not null references public.catalog_categories(category_key) on delete restrict,
  name text not null,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists catalog_subcategories_category_name_unique
on public.catalog_subcategories (category_key, lower(name));

create index if not exists catalog_subcategories_category_key_idx
on public.catalog_subcategories (category_key, sort_order);

create table if not exists public.catalog_change_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid,
  action text not null,
  category_key text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists catalog_change_log_created_at_idx
on public.catalog_change_log (created_at desc);

insert into public.catalog_categories (category_key, name, description, sort_order)
values
  ('labios', 'Lábios', 'Cor, brilho e cuidado', 1),
  ('olhos', 'Olhos', 'Destaque seu olhar', 2),
  ('pele', 'Pele', 'Uma pele impecável', 3),
  ('skincare', 'Skincare', 'Sua rotina de cuidado', 4),
  ('pinceis', 'Pincéis', 'Acabamento profissional', 5),
  ('kits', 'Paletas', 'Cores para todos os looks', 6),
  ('acessorios', 'Acessórios', 'Detalhes que completam', 7)
on conflict (category_key) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.catalog_subcategories (category_key, name, sort_order)
values
  ('labios', 'Gloss', 1), ('labios', 'Batons', 2), ('labios', 'Lip Tint', 3),
  ('labios', 'Balm', 4), ('labios', 'Lápis Labial', 5),
  ('olhos', 'Máscara de Cílios', 1), ('olhos', 'Delineadores', 2), ('olhos', 'Lápis', 3),
  ('olhos', 'Sobrancelhas', 4), ('olhos', 'Cílios', 5), ('olhos', 'Cola de Cílios', 6),
  ('olhos', 'Pigmentos', 7), ('olhos', 'Glitter', 8),
  ('pele', 'Bases', 1), ('pele', 'Corretivos', 2), ('pele', 'Pós', 3),
  ('pele', 'Primers', 4), ('pele', 'Brumas', 5),
  ('skincare', 'Séruns', 1), ('skincare', 'Hidratantes', 2), ('skincare', 'Esfoliantes', 3),
  ('skincare', 'Limpeza Facial', 4), ('skincare', 'Protetor Solar', 5), ('skincare', 'Máscaras', 6),
  ('pinceis', 'Pincéis para Rosto', 1), ('pinceis', 'Pincéis para Olhos', 2),
  ('pinceis', 'Kits de Pincéis', 3), ('pinceis', 'Esponjas', 4),
  ('kits', 'Blush', 1), ('kits', 'Iluminador', 2), ('kits', 'Contorno', 3),
  ('kits', 'Sombra', 4), ('kits', 'Multifuncionais', 5),
  ('acessorios', 'Necessaires', 1), ('acessorios', 'Espelhos', 2),
  ('acessorios', 'Organizadores', 3), ('acessorios', 'Aplicadores', 4),
  ('acessorios', 'Óculos', 5), ('acessorios', 'Bolsa', 6), ('acessorios', 'Chapinhas', 7),
  ('acessorios', 'Xuxinha', 8), ('acessorios', 'Strass', 9), ('acessorios', 'Navalhas', 10),
  ('acessorios', 'Escovas', 11)
on conflict do nothing;

update public.catalog_categories as category
set image_url = image.image_url,
    image_path = image.image_path,
    updated_at = greatest(category.updated_at, image.updated_at)
from public.category_images as image
where image.category_key = category.category_key;

alter table public.catalog_categories enable row level security;
alter table public.catalog_subcategories enable row level security;
alter table public.catalog_change_log enable row level security;

grant select on table public.catalog_categories, public.catalog_subcategories to anon, authenticated;
revoke insert, update, delete on table public.catalog_categories, public.catalog_subcategories from anon, authenticated;
revoke usage, select on sequence public.catalog_subcategories_id_seq from anon, authenticated;
revoke all on table public.catalog_change_log from anon, authenticated;
revoke usage, select on sequence public.catalog_change_log_id_seq from anon, authenticated;

drop policy if exists "Categorias ativas podem ser visualizadas" on public.catalog_categories;
create policy "Categorias ativas podem ser visualizadas"
on public.catalog_categories for select to anon, authenticated
using (is_active = true);

drop policy if exists "Subcategorias ativas podem ser visualizadas" on public.catalog_subcategories;
create policy "Subcategorias ativas podem ser visualizadas"
on public.catalog_subcategories for select to anon, authenticated
using (
  exists (
    select 1 from public.catalog_categories
    where catalog_categories.category_key = catalog_subcategories.category_key
      and catalog_categories.is_active = true
  )
);

create or replace function public.rename_catalog_category(
  p_category_key text,
  p_new_name text,
  p_admin_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_name text;
  affected_products integer;
begin
  select name into previous_name
  from public.catalog_categories
  where category_key = p_category_key
  for update;

  if previous_name is null then
    raise exception 'Categoria não encontrada.';
  end if;

  update public.products
  set category = p_new_name
  where category = previous_name;
  get diagnostics affected_products = row_count;

  update public.catalog_categories
  set name = p_new_name, updated_at = now()
  where category_key = p_category_key;

  insert into public.catalog_change_log (admin_user_id, action, category_key, details)
  values (p_admin_user_id, 'rename_category', p_category_key, jsonb_build_object(
    'previous_name', previous_name,
    'new_name', p_new_name,
    'affected_products', affected_products
  ));

  return affected_products;
end;
$$;

create or replace function public.rename_catalog_subcategory(
  p_category_key text,
  p_previous_name text,
  p_new_name text,
  p_admin_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  affected_products integer;
begin
  select name into category_name
  from public.catalog_categories
  where category_key = p_category_key
  for update;

  if category_name is null then
    raise exception 'Categoria não encontrada.';
  end if;

  update public.products
  set subcategory = p_new_name
  where category = category_name and subcategory = p_previous_name;
  get diagnostics affected_products = row_count;

  update public.catalog_subcategories
  set name = p_new_name
  where category_key = p_category_key and name = p_previous_name;

  if not found then
    raise exception 'Subcategoria não encontrada.';
  end if;

  insert into public.catalog_change_log (admin_user_id, action, category_key, details)
  values (p_admin_user_id, 'rename_subcategory', p_category_key, jsonb_build_object(
    'previous_name', p_previous_name,
    'new_name', p_new_name,
    'affected_products', affected_products
  ));

  return affected_products;
end;
$$;

create or replace function public.reorder_catalog_categories(
  p_category_keys text[],
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(p_category_keys) <> (select count(*) from public.catalog_categories)
    or exists (
      select 1 from unnest(p_category_keys) as requested(category_key)
      where not exists (
        select 1 from public.catalog_categories
        where catalog_categories.category_key = requested.category_key
      )
    )
    or (select count(distinct requested.item) from unnest(p_category_keys) as requested(item)) <> cardinality(p_category_keys)
  then
    raise exception 'A lista de categorias está incompleta ou inválida.';
  end if;

  update public.catalog_categories as category
  set sort_order = requested.position::smallint, updated_at = now()
  from unnest(p_category_keys) with ordinality as requested(category_key, position)
  where category.category_key = requested.category_key;

  insert into public.catalog_change_log (admin_user_id, action, category_key, details)
  values (p_admin_user_id, 'reorder_categories', p_category_keys[1], jsonb_build_object('category_keys', p_category_keys));
end;
$$;

create or replace function public.reorder_catalog_subcategories(
  p_category_key text,
  p_subcategories text[],
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(p_subcategories) <> (
      select count(*) from public.catalog_subcategories where category_key = p_category_key
    )
    or exists (
      select 1 from unnest(p_subcategories) as requested(name)
      where not exists (
        select 1 from public.catalog_subcategories
        where catalog_subcategories.category_key = p_category_key
          and catalog_subcategories.name = requested.name
      )
    )
    or (select count(distinct requested.item) from unnest(p_subcategories) as requested(item)) <> cardinality(p_subcategories)
  then
    raise exception 'A lista de subcategorias está incompleta ou inválida.';
  end if;

  update public.catalog_subcategories as subcategory
  set sort_order = requested.position::smallint
  from unnest(p_subcategories) with ordinality as requested(name, position)
  where subcategory.category_key = p_category_key
    and subcategory.name = requested.name;

  insert into public.catalog_change_log (admin_user_id, action, category_key, details)
  values (p_admin_user_id, 'reorder_subcategories', p_category_key, jsonb_build_object('subcategories', p_subcategories));
end;
$$;

revoke all on function public.rename_catalog_category(text, text, uuid) from public, anon, authenticated;
revoke all on function public.rename_catalog_subcategory(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.reorder_catalog_categories(text[], uuid) from public, anon, authenticated;
revoke all on function public.reorder_catalog_subcategories(text, text[], uuid) from public, anon, authenticated;
grant execute on function public.rename_catalog_category(text, text, uuid) to service_role;
grant execute on function public.rename_catalog_subcategory(text, text, text, uuid) to service_role;
grant execute on function public.reorder_catalog_categories(text[], uuid) to service_role;
grant execute on function public.reorder_catalog_subcategories(text, text[], uuid) to service_role;
