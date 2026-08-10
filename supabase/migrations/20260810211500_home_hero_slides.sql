create table if not exists public.hero_slides (
  slot smallint primary key check (slot between 1 and 4),
  image_url text,
  image_path text,
  eyebrow varchar(60) not null default '',
  title varchar(120) not null default '',
  description varchar(300) not null default '',
  updated_at timestamptz not null default now(),
  constraint hero_slides_image_pair_check check (
    (image_url is null and image_path is null)
    or (image_url is not null and image_path is not null)
  )
);

alter table public.hero_slides enable row level security;

grant select on table public.hero_slides to anon, authenticated;
revoke insert, update, delete on table public.hero_slides from anon, authenticated;

drop policy if exists "Destaques publicos podem ser visualizados" on public.hero_slides;
create policy "Destaques publicos podem ser visualizados"
on public.hero_slides
for select
to anon, authenticated
using (true);

