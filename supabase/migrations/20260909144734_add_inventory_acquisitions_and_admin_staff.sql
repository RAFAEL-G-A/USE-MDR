-- Produtos continuam sendo o cadastro comercial. Entradas de mercadoria passam
-- a ser registradas separadamente e recalculam o custo medio de forma atomica.

create table if not exists public.admin_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  role text not null default 'operator' check (role in ('owner', 'manager', 'operator')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_staff_email_normalized check (email = lower(trim(email)))
);

create unique index if not exists admin_staff_email_unique_idx
  on public.admin_staff (lower(email));

alter table public.admin_staff enable row level security;
revoke all on table public.admin_staff from public, anon, authenticated;
grant select, insert, update on table public.admin_staff to service_role;

comment on table public.admin_staff is
  'Equipe autorizada a acessar o painel. A autorizacao efetiva e validada nas Edge Functions.';

create table if not exists public.inventory_acquisitions (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  movement_type text not null default 'acquisition' check (movement_type in ('opening_balance', 'acquisition')),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock > 0),
  previous_average_cost numeric(12, 2) not null check (previous_average_cost >= 0),
  new_average_cost numeric(12, 2) not null check (new_average_cost >= 0),
  sale_price_before numeric(16, 8) not null check (sale_price_before > 0),
  sale_price_after numeric(16, 8) not null check (sale_price_after > 0),
  supplier text check (supplier is null or char_length(supplier) <= 160),
  document_reference text check (document_reference is null or char_length(document_reference) <= 120),
  notes text check (notes is null or char_length(notes) <= 500),
  acquired_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_acquisitions_product_date_idx
  on public.inventory_acquisitions (product_id, acquired_at desc);

create index if not exists inventory_acquisitions_date_idx
  on public.inventory_acquisitions (acquired_at desc);

alter table public.inventory_acquisitions enable row level security;
revoke all on table public.inventory_acquisitions from public, anon, authenticated;
grant select, insert on table public.inventory_acquisitions to service_role;

comment on table public.inventory_acquisitions is
  'Historico imutavel de saldos iniciais e entradas que formam o custo medio dos produtos.';

-- Converte o estoque atual em saldo inicial sem mudar quantidade, custo ou preco.
insert into public.inventory_acquisitions (
  product_id,
  movement_type,
  quantity,
  unit_cost,
  previous_stock,
  new_stock,
  previous_average_cost,
  new_average_cost,
  sale_price_before,
  sale_price_after,
  supplier,
  notes,
  acquired_at
)
select
  product.id::text,
  'opening_balance',
  product.stock,
  coalesce(cost.cost_price, 0),
  0,
  product.stock,
  0,
  coalesce(cost.cost_price, 0),
  product.price,
  product.price,
  null,
  'Saldo existente antes da ativacao do historico de aquisicoes.',
  coalesce(product.created_at, now())
from public.products product
left join public.product_costs cost on cost.product_id = product.id::text
where product.stock > 0
  and not exists (
    select 1
    from public.inventory_acquisitions existing
    where existing.product_id = product.id::text
      and existing.movement_type = 'opening_balance'
  );

create or replace function public.register_inventory_acquisition(
  p_product_id text,
  p_quantity integer,
  p_unit_cost numeric,
  p_sale_price numeric,
  p_supplier text,
  p_document_reference text,
  p_notes text,
  p_acquired_at timestamptz,
  p_created_by uuid
)
returns public.inventory_acquisitions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product record;
  v_previous_average numeric(12, 2);
  v_new_average numeric(12, 2);
  v_sale_price numeric(16, 8);
  v_entry public.inventory_acquisitions;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'O custo unitario nao pode ser negativo.';
  end if;
  if p_sale_price is not null and p_sale_price <= 0 then
    raise exception 'O preco de venda deve ser maior que zero.';
  end if;
  if char_length(coalesce(trim(p_supplier), '')) > 160
    or char_length(coalesce(trim(p_document_reference), '')) > 120
    or char_length(coalesce(trim(p_notes), '')) > 500 then
    raise exception 'Os dados complementares excedem o limite permitido.';
  end if;

  select product.id::text as id, product.stock, product.price
  into v_product
  from public.products product
  where product.id::text = p_product_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  select coalesce(cost.cost_price, 0)
  into v_previous_average
  from public.product_costs cost
  where cost.product_id = p_product_id;
  v_previous_average := coalesce(v_previous_average, 0);

  v_new_average := round(
    ((v_product.stock * v_previous_average) + (p_quantity * p_unit_cost))
      / (v_product.stock + p_quantity),
    2
  );
  v_sale_price := coalesce(p_sale_price, v_product.price);

  update public.products
  set stock = v_product.stock + p_quantity,
      price = v_sale_price
  where id::text = p_product_id;

  insert into public.product_costs (product_id, cost_price, updated_by, updated_at)
  values (p_product_id, v_new_average, p_created_by, now())
  on conflict (product_id) do update
  set cost_price = excluded.cost_price,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.inventory_acquisitions (
    product_id,
    quantity,
    unit_cost,
    previous_stock,
    new_stock,
    previous_average_cost,
    new_average_cost,
    sale_price_before,
    sale_price_after,
    supplier,
    document_reference,
    notes,
    acquired_at,
    created_by
  ) values (
    p_product_id,
    p_quantity,
    round(p_unit_cost, 2),
    v_product.stock,
    v_product.stock + p_quantity,
    v_previous_average,
    v_new_average,
    v_product.price,
    v_sale_price,
    nullif(trim(p_supplier), ''),
    nullif(trim(p_document_reference), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_acquired_at, now()),
    p_created_by
  ) returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.register_inventory_acquisition(
  text, integer, numeric, numeric, text, text, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.register_inventory_acquisition(
  text, integer, numeric, numeric, text, text, text, timestamptz, uuid
) to service_role;
