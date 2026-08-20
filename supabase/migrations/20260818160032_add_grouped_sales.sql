alter table public.sales
  add column if not exists order_id uuid not null default gen_random_uuid();

create index if not exists sales_order_id_idx on public.sales (order_id);

create or replace function public.register_sales_batch(
  p_items jsonb,
  p_payment_method text,
  p_payment_status text,
  p_sold_at timestamptz,
  p_notes text,
  p_customer_name text,
  p_created_by uuid
)
returns setof public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_sale public.sales;
  v_order_id uuid := gen_random_uuid();
  v_item_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'A lista de produtos é inválida.';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'A venda deve conter entre 1 e 50 produtos.';
  end if;
  if p_customer_name is not null and char_length(trim(p_customer_name)) > 160 then
    raise exception 'O nome do cliente deve ter até 160 caracteres.';
  end if;
  if p_notes is not null and char_length(trim(p_notes)) > 500 then
    raise exception 'A observação deve ter até 500 caracteres.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item->>'product_id'
    having count(*) > 1
  ) then
    raise exception 'O mesmo produto aparece mais de uma vez na venda.';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_items) item
    order by item->>'product_id'
  loop
    if coalesce(v_item->>'product_id', '') = ''
      or coalesce(v_item->>'quantity', '') !~ '^[0-9]+$'
      or coalesce(v_item->>'unit_price', '') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'Há um produto com quantidade ou valor inválido.';
    end if;

    v_sale := public.register_sale(
      v_item->>'product_id',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      p_payment_method,
      p_payment_status,
      coalesce(p_sold_at, now()),
      nullif(trim(p_notes), ''),
      p_created_by
    );

    update public.sales
    set order_id = v_order_id,
        customer_name = nullif(trim(p_customer_name), '')
    where id = v_sale.id
    returning * into v_sale;

    return next v_sale;
  end loop;
end;
$$;

create or replace function public.settle_sale_order(
  p_order_id uuid,
  p_payment_method text
)
returns setof public.sales
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_payment_method not in ('credit_card', 'debit_card', 'pix', 'cash') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if not exists (
    select 1 from public.sales
    where order_id = p_order_id and voided_at is null
  ) then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;

  return query
  update public.sales
  set payment_status = 'paid',
      payment_method = p_payment_method,
      payment_received_at = coalesce(payment_received_at, now())
  where order_id = p_order_id and voided_at is null
  returning *;
end;
$$;

create or replace function public.void_sale_order(p_order_id uuid)
returns setof public.sales
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.sales
    where order_id = p_order_id and voided_at is null
    for update
  ) then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;

  update public.products product
  set stock = product.stock + returned.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.sales
    where order_id = p_order_id and voided_at is null
    group by product_id
  ) returned
  where product.id::text = returned.product_id;

  return query
  update public.sales
  set voided_at = now()
  where order_id = p_order_id and voided_at is null
  returning *;
end;
$$;

create or replace function public.get_financial_metrics(
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revenue numeric(12, 2) := 0;
  v_received numeric(12, 2) := 0;
  v_receivable numeric(12, 2) := 0;
  v_cost numeric(12, 2) := 0;
  v_expenses numeric(12, 2) := 0;
  v_pending_expenses numeric(12, 2) := 0;
  v_orders integer := 0;
  v_ticket numeric(12, 2) := 0;
  v_payments jsonb := '{}'::jsonb;
  v_top_selling jsonb := '[]'::jsonb;
  v_top_profitable jsonb := '[]'::jsonb;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Período financeiro inválido.';
  end if;

  select coalesce(sum(total_amount), 0),
         coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0),
         coalesce(sum(total_amount) filter (where payment_status = 'pending'), 0),
         coalesce(sum(total_cost), 0),
         count(distinct order_id)::integer
  into v_revenue, v_received, v_receivable, v_cost, v_orders
  from public.sales
  where voided_at is null
    and public.financial_business_date(sold_at) between p_period_start and p_period_end;

  select coalesce(sum(amount) filter (where status = 'paid'), 0),
         coalesce(sum(amount) filter (where status = 'pending'), 0)
  into v_expenses, v_pending_expenses
  from public.expenses
  where status <> 'void'
    and public.financial_business_date(occurred_at) between p_period_start and p_period_end;

  if v_orders > 0 then v_ticket := round(v_revenue / v_orders, 2); end if;

  select coalesce(jsonb_object_agg(payment_group, payment_summary), '{}'::jsonb)
  into v_payments
  from (
    select case when payment_method = 'cash' then 'cash'
                when payment_method = 'pix' then 'pix'
                when payment_method in ('credit_card', 'debit_card') then 'card'
                else payment_method end as payment_group,
           jsonb_build_object('amount', round(sum(total_amount), 2),
                              'sales', count(distinct order_id)) as payment_summary
    from public.sales
    where voided_at is null and payment_status = 'paid'
      and public.financial_business_date(coalesce(payment_received_at, sold_at)) between p_period_start and p_period_end
    group by 1
  ) grouped_payments;

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into v_top_selling
  from (
    select product_id, max(product_name) as product_name, sum(quantity)::integer as quantity,
           round(sum(total_amount), 2) as revenue
    from public.sales
    where voided_at is null and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by product_id order by sum(quantity) desc, sum(total_amount) desc limit 5
  ) product_row;

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into v_top_profitable
  from (
    select product_id, max(product_name) as product_name, sum(quantity)::integer as quantity,
           round(sum(gross_profit), 2) as profit
    from public.sales
    where voided_at is null and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by product_id order by sum(gross_profit) desc, sum(quantity) desc limit 5
  ) product_row;

  return jsonb_build_object(
    'period_start', p_period_start, 'period_end', p_period_end, 'timezone', 'America/Recife',
    'gross_revenue', round(v_revenue, 2), 'received_revenue', round(v_received, 2),
    'receivable_revenue', round(v_receivable, 2), 'cost_of_goods', round(v_cost, 2),
    'gross_profit', round(v_revenue - v_cost, 2), 'expenses', round(v_expenses, 2),
    'pending_expenses', round(v_pending_expenses, 2), 'net_profit', round(v_revenue - v_cost - v_expenses, 2),
    'orders', v_orders, 'average_ticket', round(v_ticket, 2), 'payments', v_payments,
    'top_selling_products', v_top_selling, 'top_profitable_products', v_top_profitable
  );
end;
$$;

create or replace function public.get_financial_series(p_period_start date, p_period_end date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_series jsonb;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Período financeiro inválido.';
  end if;
  if p_period_end - p_period_start > 370 then
    raise exception 'O período máximo da série é de 370 dias.';
  end if;

  with days as (
    select generate_series(p_period_start, p_period_end, interval '1 day')::date as business_date
  ), sales_by_day as (
    select public.financial_business_date(sold_at) as business_date,
           sum(total_amount) as revenue, sum(total_cost) as cost,
           count(distinct order_id)::integer as orders
    from public.sales
    where voided_at is null and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by 1
  ), expenses_by_day as (
    select public.financial_business_date(occurred_at) as business_date, sum(amount) as expenses
    from public.expenses
    where status = 'paid' and public.financial_business_date(occurred_at) between p_period_start and p_period_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', days.business_date, 'revenue', round(coalesce(sales_by_day.revenue, 0), 2),
    'cost', round(coalesce(sales_by_day.cost, 0), 2),
    'expenses', round(coalesce(expenses_by_day.expenses, 0), 2),
    'net_profit', round(coalesce(sales_by_day.revenue, 0) - coalesce(sales_by_day.cost, 0) - coalesce(expenses_by_day.expenses, 0), 2),
    'orders', coalesce(sales_by_day.orders, 0)
  ) order by days.business_date), '[]'::jsonb)
  into v_series
  from days left join sales_by_day using (business_date) left join expenses_by_day using (business_date);
  return v_series;
end;
$$;

revoke all on function public.register_sales_batch(jsonb, text, text, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function public.settle_sale_order(uuid, text) from public, anon, authenticated;
revoke all on function public.void_sale_order(uuid) from public, anon, authenticated;
revoke all on function public.get_financial_metrics(date, date) from public, anon, authenticated;
revoke all on function public.get_financial_series(date, date) from public, anon, authenticated;

grant execute on function public.register_sales_batch(jsonb, text, text, timestamptz, text, text, uuid) to service_role;
grant execute on function public.settle_sale_order(uuid, text) to service_role;
grant execute on function public.void_sale_order(uuid) to service_role;
grant execute on function public.get_financial_metrics(date, date) to service_role;
grant execute on function public.get_financial_series(date, date) to service_role;
