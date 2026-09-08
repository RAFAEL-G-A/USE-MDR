-- Reorganiza o catálogo sem recriar produtos ou alterar seus identificadores,
-- imagens, descrições, preços e estoque.

update public.products
set category = 'Paletas',
    subcategory = case
      when lower(trim(subcategory)) in ('iluminador', 'iluminadores') then 'Iluminador'
      when lower(trim(subcategory)) in ('sombra', 'sombras', 'paletas de sombras') then 'Sombra'
      when lower(trim(subcategory)) in ('multifuncionais', 'paletas multifuncionais', 'paletas de rosto') then 'Multifuncionais'
      when lower(trim(subcategory)) = 'blush' then 'Blush'
      when lower(trim(subcategory)) = 'contorno' then 'Contorno'
      else subcategory
    end
where category in ('Pele', 'Olhos', 'Paletas')
  and lower(trim(subcategory)) in (
  'blush',
  'iluminador',
  'iluminadores',
  'contorno',
  'sombra',
  'sombras',
  'paletas de sombras',
  'multifuncionais',
  'paletas multifuncionais',
  'paletas de rosto'
  );

update public.products
set subcategory = 'Primers'
where category = 'Pele'
  and lower(trim(subcategory)) in ('primer', 'primers');

update public.products
set subcategory = 'Cola de Cílios'
where category = 'Olhos'
  and lower(trim(subcategory)) in ('cola', 'cola de cílios');
