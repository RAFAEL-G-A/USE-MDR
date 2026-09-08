-- Mantém o valor unitário exibido com duas casas, mas permite que uma venda
-- com várias unidades seja distribuída internamente sem perder centavos.
-- As colunas calculadas precisam ser recriadas porque dependem de unit_price.
alter table public.sales
  drop column gross_profit,
  drop column total_amount;

alter table public.sales
  alter column unit_price type numeric(16, 8) using unit_price::numeric(16, 8);

alter table public.sales
  add column total_amount numeric(12, 2)
    generated always as (quantity * unit_price) stored,
  add column gross_profit numeric(12, 2)
    generated always as ((quantity * unit_price) - (quantity * unit_cost)) stored;
