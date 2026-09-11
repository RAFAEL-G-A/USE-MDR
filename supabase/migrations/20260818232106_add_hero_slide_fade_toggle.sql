alter table public.hero_slides
add column if not exists fade_enabled boolean not null default true;

comment on column public.hero_slides.fade_enabled is
  'Controla se o degradê/esmaecimento é exibido sobre a imagem do slide.';
