-- Correções auditáveis de vendas. A venda é atualizada de forma atômica,
-- o estoque recebe somente a diferença e os dados anteriores são preservados.

alter table public.sales
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sale_order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  previous_total numeric(12, 2) not null,
  corrected_total numeric(12, 2) not null,
  previous_snapshot jsonb not null,
  corrected_snapshot jsonb not null,
  reason text not null check (char_length(trim(reason)) between 3 and 240),
  corrected_by uuid,
  corrected_at timestamptz not null default now()
);

create index if not exists sale_order_revisions_order_idx
  on public.sale_order_revisions (order_id, corrected_at desc);
create index if not exists sale_order_revisions_corrected_idx
  on public.sale_order_revisions (corrected_at desc);

alter table public.sale_order_revisions enable row level security;
revoke all on table public.sale_order_revisions from public, anon, authenticated;

create or replace function public.update_sale_order(
  p_order_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_payment_method text,
  p_payment_status text,
  p_sold_at timestamptz,
  p_notes text,
  p_reason text,
  p_corrected_by uuid
)
returns setof public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_old public.sales;
  v_delta integer;
  v_previous_snapshot jsonb;
  v_corrected_snapshot jsonb;
  v_previous_total numeric(12, 2);
  v_corrected_total numeric(12, 2);
  v_item_count integer;
begin
  if p_order_id is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Venda ou lista de produtos inválida.';
  end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'A venda deve conter entre 1 e 50 produtos.';
  end if;
  if p_payment_method not in ('credit_card', 'debit_card', 'pix', 'cash') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_payment_status not in ('paid', 'pending') then
    raise exception 'Situação do pagamento inválida.';
  end if;
  if p_sold_at is null then
    raise exception 'Data da venda inválida.';
  end if;
  if p_customer_name is not null and char_length(trim(p_customer_name)) > 160 then
    raise exception 'O nome do cliente deve ter até 160 caracteres.';
  end if;
  if p_notes is not null and char_length(trim(p_notes)) > 500 then
    raise exception 'A observação deve ter até 500 caracteres.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) not between 3 and 240 then
    raise exception 'Informe o motivo da correção com 3 a 240 caracteres.';
  end if;

  perform id from public.sales
  where order_id = p_order_id and voided_at is null
  order by id
  for update;

  if not found then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;
  if (select count(*) from public.sales where order_id = p_order_id and voided_at is null) <> v_item_count then
    raise exception 'A correção deve conter todos os produtos da venda.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item->>'sale_id', '') = ''
      or coalesce(item->>'quantity', '') !~ '^[0-9]+$'
      or coalesce(item->>'unit_price', '') !~ '^[0-9]+([.][0-9]+)?$'
      or (item->>'quantity')::integer <= 0
      or (item->>'unit_price')::numeric <= 0
  ) or exists (
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'sale_id' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.sales sale on sale.id::text = item->>'sale_id'
      and sale.order_id = p_order_id and sale.voided_at is null
    where sale.id is null
  ) then
    raise exception 'Há um produto com quantidade ou valor inválido.';
  end if;

  select jsonb_agg(to_jsonb(sale) order by sale.id), sum(sale.total_amount)
  into v_previous_snapshot, v_previous_total
  from public.sales sale
  where sale.order_id = p_order_id and sale.voided_at is null;

  perform product.id from public.products product
  where product.id::text in (
    select sale.product_id from public.sales sale where sale.order_id = p_order_id and sale.voided_at is null
  )
  order by product.id
  for update;

  for v_item in select item from jsonb_array_elements(p_items) item order by item->>'sale_id'
  loop
    select * into strict v_old from public.sales
    where id::text = v_item->>'sale_id' and order_id = p_order_id and voided_at is null;
    v_delta := (v_item->>'quantity')::integer - v_old.quantity;

    if v_delta > 0 then
      update public.products set stock = stock - v_delta
      where id::text = v_old.product_id and stock >= v_delta;
      if not found then
        raise exception 'Estoque insuficiente para corrigir o produto %.', v_old.product_name;
      end if;
    elsif v_delta < 0 then
      update public.products set stock = stock + abs(v_delta)
      where id::text = v_old.product_id;
    end if;

    update public.sales
    set quantity = (v_item->>'quantity')::integer,
        unit_price = (v_item->>'unit_price')::numeric,
        updated_at = now()
    where id = v_old.id;
  end loop;

  update public.sales
  set customer_name = nullif(trim(p_customer_name), ''),
      payment_method = p_payment_method,
      payment_status = p_payment_status,
      payment_received_at = case
        when p_payment_status = 'pending' then null
        else coalesce(payment_received_at, now())
      end,
      sold_at = p_sold_at,
      notes = nullif(trim(p_notes), ''),
      updated_at = now()
  where order_id = p_order_id and voided_at is null;

  select jsonb_agg(to_jsonb(sale) order by sale.id), sum(sale.total_amount)
  into v_corrected_snapshot, v_corrected_total
  from public.sales sale
  where sale.order_id = p_order_id and sale.voided_at is null;

  insert into public.sale_order_revisions (
    order_id, previous_total, corrected_total, previous_snapshot,
    corrected_snapshot, reason, corrected_by
  ) values (
    p_order_id, v_previous_total, v_corrected_total, v_previous_snapshot,
    v_corrected_snapshot, trim(p_reason), p_corrected_by
  );

  return query select * from public.sales
  where order_id = p_order_id and voided_at is null order by id;
end;
$$;

create or replace function public.get_sale_corrections(
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_corrections jsonb;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Período de correções inválido.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'order_id', revision.order_id,
    'sale_date', public.financial_business_date((revision.previous_snapshot->0->>'sold_at')::timestamptz),
    'previous_total', revision.previous_total,
    'corrected_total', revision.corrected_total,
    'difference', revision.corrected_total - revision.previous_total,
    'reason', revision.reason,
    'corrected_at', revision.corrected_at
  ) order by revision.corrected_at), '[]'::jsonb)
  into v_corrections
  from public.sale_order_revisions revision
  where public.financial_business_date(revision.corrected_at) between p_period_start and p_period_end;
  return v_corrections;
end;
$$;

create or replace function public.create_financial_closure(
  p_period_type text,
  p_period_start date,
  p_period_end date,
  p_generated_by uuid default null
)
returns public.financial_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure public.financial_closures;
  v_duration integer;
  v_previous_end date;
  v_previous_start date;
  v_metrics jsonb;
begin
  if p_period_type not in ('daily', 'weekly', 'monthly') then raise exception 'Tipo de fechamento inválido.'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then raise exception 'Período de fechamento inválido.'; end if;
  v_duration := p_period_end - p_period_start + 1;
  v_previous_end := p_period_start - 1;
  v_previous_start := v_previous_end - (v_duration - 1);
  v_metrics := public.get_financial_metrics(p_period_start, p_period_end)
    || jsonb_build_object(
      'previous_metrics', public.get_financial_metrics(v_previous_start, v_previous_end),
      'previous_period_start', v_previous_start,
      'previous_period_end', v_previous_end,
      'sale_corrections', public.get_sale_corrections(p_period_start, p_period_end)
    );
  insert into public.financial_closures (period_type, period_start, period_end, metrics, generated_by)
  values (p_period_type, p_period_start, p_period_end, v_metrics, p_generated_by)
  on conflict (period_type, period_start, period_end) do update
    set metrics = excluded.metrics,
        generated_by = excluded.generated_by,
        generated_at = now()
    where public.financial_closures.email_status <> 'sent'
  returning * into v_closure;
  if v_closure.id is null then
    select * into v_closure from public.financial_closures
    where period_type = p_period_type and period_start = p_period_start and period_end = p_period_end;
  end if;
  return v_closure;
end;
$$;

revoke all on function public.update_sale_order(uuid, jsonb, text, text, text, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_sale_corrections(date, date) from public, anon, authenticated;
revoke all on function public.create_financial_closure(text, date, date, uuid) from public, anon, authenticated;
grant execute on function public.update_sale_order(uuid, jsonb, text, text, text, timestamptz, text, text, uuid) to service_role;
grant execute on function public.get_sale_corrections(date, date) to service_role;
grant execute on function public.create_financial_closure(text, date, date, uuid) to service_role;
