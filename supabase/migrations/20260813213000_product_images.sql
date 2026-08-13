create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  image_url text not null,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

create index if not exists product_images_product_order_idx
on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

grant select on table public.product_images to anon, authenticated;
revoke insert, update, delete on table public.product_images from anon, authenticated;

drop policy if exists "Catalogo publico pode visualizar galeria de produtos" on public.product_images;
create policy "Catalogo publico pode visualizar galeria de produtos"
on public.product_images
for select
to anon, authenticated
using (true);

comment on table public.product_images is
'Imagens adicionais exibidas somente na pagina individual do produto. A capa permanece em products.image_url.';
