create table if not exists public.catalog_promotion_showcase (
  singleton boolean primary key default true check (singleton = true),
  title text not null default 'Produtos com desconto' check (char_length(btrim(title)) between 1 and 40),
  description text not null default 'Ofertas selecionadas' check (char_length(description) <= 100),
  image_url text,
  image_path text,
  updated_at timestamptz not null default now()
);

insert into public.catalog_promotion_showcase (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.catalog_promotion_showcase enable row level security;

revoke all on table public.catalog_promotion_showcase from public, anon, authenticated;
grant select on table public.catalog_promotion_showcase to anon, authenticated;
grant select, insert, update, delete on table public.catalog_promotion_showcase to service_role;

drop policy if exists "Vitrine de promoções pode ser visualizada" on public.catalog_promotion_showcase;
create policy "Vitrine de promoções pode ser visualizada"
on public.catalog_promotion_showcase for select to anon, authenticated
using (singleton = true);

comment on table public.catalog_promotion_showcase is
  'Configuração pública da vitrine virtual de promoções, separada das categorias reais dos produtos.';
