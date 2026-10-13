alter table public.products
  add column if not exists promotional_price numeric(16, 8),
  add column if not exists show_in_promotions boolean not null default false;

alter table public.products drop constraint if exists products_promotional_price_valid;
alter table public.products add constraint products_promotional_price_valid check (
  promotional_price is null or (promotional_price > 0 and promotional_price < price)
);

alter table public.products drop constraint if exists products_promotions_visibility_valid;
alter table public.products add constraint products_promotions_visibility_valid check (
  show_in_promotions = false or promotional_price is not null
);

create index if not exists products_promotions_catalog_idx
  on public.products (show_in_promotions, created_at desc)
  where show_in_promotions = true and promotional_price is not null and stock > 0;

comment on column public.products.promotional_price is
  'Optional active sale price. Must be positive and lower than the regular price.';
comment on column public.products.show_in_promotions is
  'Adds the product to the virtual promotions showcase without changing its category or subcategory.';
