create table if not exists public.category_images (
  category_key text primary key check (category_key in ('labios', 'olhos', 'pele', 'skincare', 'pinceis', 'kits', 'acessorios')),
  image_url text not null,
  image_path text not null,
  updated_at timestamptz not null default now()
);

alter table public.category_images enable row level security;

grant select on table public.category_images to anon, authenticated;
revoke insert, update, delete on table public.category_images from anon, authenticated;

drop policy if exists "Imagens de categorias podem ser visualizadas" on public.category_images;
create policy "Imagens de categorias podem ser visualizadas"
on public.category_images
for select
to anon, authenticated
using (true);
