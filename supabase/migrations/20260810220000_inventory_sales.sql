create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  total_amount numeric(12, 2) generated always as (quantity * unit_price) stored,
  payment_method text not null check (payment_method in ('credit_card', 'debit_card', 'pix', 'cash')),
  payment_status text not null check (payment_status in ('paid', 'pending')),
  sold_at timestamptz not null default now(),
  notes text check (char_length(notes) <= 500),
  voided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists sales_sold_at_idx on public.sales (sold_at desc);
create index if not exists sales_product_id_idx on public.sales (product_id);
create index if not exists sales_payment_status_idx on public.sales (payment_status) where voided_at is null;

alter table public.sales enable row level security;
revoke all on table public.sales from anon, authenticated;

create or replace function public.register_sale(
  p_product_id text,
  p_quantity integer,
  p_unit_price numeric,
  p_payment_method text,
  p_payment_status text,
  p_sold_at timestamptz,
  p_notes text,
  p_created_by uuid
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_sale public.sales;
begin
  if p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;
  if p_unit_price <= 0 then
    raise exception 'O valor unitário deve ser maior que zero.';
  end if;
  if p_payment_method not in ('credit_card', 'debit_card', 'pix', 'cash') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_payment_status not in ('paid', 'pending') then
    raise exception 'Situação do pagamento inválida.';
  end if;

  select id::text as id, name, stock
  into v_product
  from public.products
  where id::text = p_product_id
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;
  if v_product.stock < p_quantity then
    raise exception 'Estoque insuficiente. Disponível: %.', v_product.stock;
  end if;

  update public.products
  set stock = stock - p_quantity
  where id::text = p_product_id;

  insert into public.sales (
    product_id,
    product_name,
    quantity,
    unit_price,
    payment_method,
    payment_status,
    sold_at,
    notes,
    created_by
  ) values (
    p_product_id,
    v_product.name,
    p_quantity,
    p_unit_price,
    p_payment_method,
    p_payment_status,
    coalesce(p_sold_at, now()),
    nullif(trim(p_notes), ''),
    p_created_by
  )
  returning * into v_sale;

  return v_sale;
end;
$$;

create or replace function public.settle_sale(
  p_sale_id uuid,
  p_payment_method text
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
begin
  if p_payment_method not in ('credit_card', 'debit_card', 'pix', 'cash') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  update public.sales
  set payment_status = 'paid', payment_method = p_payment_method
  where id = p_sale_id and voided_at is null
  returning * into v_sale;

  if not found then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;
  return v_sale;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found or v_sale.voided_at is not null then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;

  update public.products
  set stock = stock + v_sale.quantity
  where id::text = v_sale.product_id;

  update public.sales
  set voided_at = now()
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.register_sale(text, integer, numeric, text, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function public.settle_sale(uuid, text) from public, anon, authenticated;
revoke all on function public.void_sale(uuid) from public, anon, authenticated;

grant execute on function public.register_sale(text, integer, numeric, text, text, timestamptz, text, uuid) to service_role;
grant execute on function public.settle_sale(uuid, text) to service_role;
grant execute on function public.void_sale(uuid) to service_role;
