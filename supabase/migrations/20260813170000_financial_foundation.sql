-- Base financeira da USE MDR.
-- Evolui a tabela sales existente sem apagar ou recalcular vendas anteriores.

create table if not exists public.product_costs (
  product_id text primary key,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_costs enable row level security;
revoke all on table public.product_costs from public, anon, authenticated;

alter table public.sales
  add column if not exists unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  add column if not exists customer_name text check (char_length(customer_name) <= 160),
  add column if not exists payment_received_at timestamptz;

update public.sales
set payment_received_at = coalesce(payment_received_at, sold_at)
where payment_status = 'paid' and payment_received_at is null;

alter table public.sales
  add column if not exists total_cost numeric(12, 2)
    generated always as (quantity * unit_cost) stored,
  add column if not exists gross_profit numeric(12, 2)
    generated always as ((quantity * unit_price) - (quantity * unit_cost)) stored;

create index if not exists sales_payment_received_at_idx
  on public.sales (payment_received_at desc)
  where voided_at is null and payment_status = 'paid';

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (category in ('suppliers', 'packaging', 'shipping', 'marketing', 'utilities', 'other')),
  occurred_at timestamptz not null default now(),
  notes text check (char_length(notes) <= 500),
  status text not null default 'paid' check (status in ('paid', 'pending', 'void')),
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_paid_at_check check (
    (status = 'paid' and paid_at is not null)
    or status in ('pending', 'void')
  )
);

create index if not exists expenses_occurred_at_idx on public.expenses (occurred_at desc);
create index if not exists expenses_status_idx on public.expenses (status, occurred_at desc);

alter table public.expenses enable row level security;
revoke all on table public.expenses from public, anon, authenticated;

create table if not exists public.financial_closures (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  timezone text not null default 'America/Recife',
  metrics jsonb not null,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'skipped', 'failed')),
  email_sent_at timestamptz,
  email_error text,
  constraint financial_closures_period_check check (period_end >= period_start),
  constraint financial_closures_unique unique (period_type, period_start, period_end)
);

create index if not exists financial_closures_period_idx
  on public.financial_closures (period_type, period_end desc);

alter table public.financial_closures enable row level security;
revoke all on table public.financial_closures from public, anon, authenticated;

create table if not exists public.financial_report_settings (
  id smallint primary key default 1 check (id = 1),
  recipient_email text,
  daily_enabled boolean not null default false,
  weekly_enabled boolean not null default false,
  monthly_enabled boolean not null default false,
  timezone text not null default 'America/Recife',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint financial_report_email_check check (
    recipient_email is null
    or recipient_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

insert into public.financial_report_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.financial_report_settings enable row level security;
revoke all on table public.financial_report_settings from public, anon, authenticated;

create table if not exists public.financial_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  job_type text not null check (job_type in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  closure_id uuid references public.financial_closures(id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists financial_job_runs_status_idx
  on public.financial_job_runs (status, started_at desc);

alter table public.financial_job_runs enable row level security;
revoke all on table public.financial_job_runs from public, anon, authenticated;

-- Converte um instante real para a data comercial da loja.
-- Após o fechamento, a movimentação pertence ao próximo dia comercial.
create or replace function public.financial_business_date(p_timestamp timestamptz)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  v_local timestamp := p_timestamp at time zone 'America/Recife';
  v_date date := v_local::date;
  v_time time := v_local::time;
  v_iso_day integer := extract(isodow from v_local)::integer;
begin
  if v_iso_day between 1 and 5 and v_time >= time '17:00' then
    return v_date + 1;
  end if;

  if v_iso_day = 6 and v_time >= time '13:00' then
    return v_date + 2;
  end if;

  if v_iso_day = 7 then
    return v_date + 1;
  end if;

  return v_date;
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

  select
    coalesce(sum(total_amount), 0),
    coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0),
    coalesce(sum(total_amount) filter (where payment_status = 'pending'), 0),
    coalesce(sum(total_cost), 0),
    count(*)::integer
  into v_revenue, v_received, v_receivable, v_cost, v_orders
  from public.sales
  where voided_at is null
    and public.financial_business_date(sold_at) between p_period_start and p_period_end;

  select
    coalesce(sum(amount) filter (where status = 'paid'), 0),
    coalesce(sum(amount) filter (where status = 'pending'), 0)
  into v_expenses, v_pending_expenses
  from public.expenses
  where status <> 'void'
    and public.financial_business_date(occurred_at) between p_period_start and p_period_end;

  if v_orders > 0 then
    v_ticket := round(v_revenue / v_orders, 2);
  end if;

  select coalesce(jsonb_object_agg(payment_group, payment_summary), '{}'::jsonb)
  into v_payments
  from (
    select
      case
        when payment_method = 'cash' then 'cash'
        when payment_method = 'pix' then 'pix'
        when payment_method in ('credit_card', 'debit_card') then 'card'
        else payment_method
      end as payment_group,
      jsonb_build_object(
        'amount', round(sum(total_amount), 2),
        'sales', count(*)
      ) as payment_summary
    from public.sales
    where voided_at is null
      and payment_status = 'paid'
      and public.financial_business_date(coalesce(payment_received_at, sold_at))
        between p_period_start and p_period_end
    group by 1
  ) grouped_payments;

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into v_top_selling
  from (
    select
      product_id,
      max(product_name) as product_name,
      sum(quantity)::integer as quantity,
      round(sum(total_amount), 2) as revenue
    from public.sales
    where voided_at is null
      and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by product_id
    order by sum(quantity) desc, sum(total_amount) desc
    limit 5
  ) product_row;

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into v_top_profitable
  from (
    select
      product_id,
      max(product_name) as product_name,
      sum(quantity)::integer as quantity,
      round(sum(gross_profit), 2) as profit
    from public.sales
    where voided_at is null
      and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by product_id
    order by sum(gross_profit) desc, sum(quantity) desc
    limit 5
  ) product_row;

  return jsonb_build_object(
    'period_start', p_period_start,
    'period_end', p_period_end,
    'timezone', 'America/Recife',
    'gross_revenue', round(v_revenue, 2),
    'received_revenue', round(v_received, 2),
    'receivable_revenue', round(v_receivable, 2),
    'cost_of_goods', round(v_cost, 2),
    'gross_profit', round(v_revenue - v_cost, 2),
    'expenses', round(v_expenses, 2),
    'pending_expenses', round(v_pending_expenses, 2),
    'net_profit', round(v_revenue - v_cost - v_expenses, 2),
    'orders', v_orders,
    'average_ticket', round(v_ticket, 2),
    'payments', v_payments,
    'top_selling_products', v_top_selling,
    'top_profitable_products', v_top_profitable
  );
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
begin
  if p_period_type not in ('daily', 'weekly', 'monthly') then
    raise exception 'Tipo de fechamento inválido.';
  end if;

  insert into public.financial_closures (
    period_type,
    period_start,
    period_end,
    metrics,
    generated_by
  ) values (
    p_period_type,
    p_period_start,
    p_period_end,
    public.get_financial_metrics(p_period_start, p_period_end),
    p_generated_by
  )
  on conflict (period_type, period_start, period_end)
  do update set id = public.financial_closures.id
  returning * into v_closure;

  return v_closure;
end;
$$;

-- Mantém a assinatura usada pela Edge Function atual e passa a gravar o
-- snapshot do custo vigente no momento da venda.
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

  select p.id::text as id, p.name, p.stock, coalesce(pc.cost_price, 0) as unit_cost
  into v_product
  from public.products p
  left join public.product_costs pc on pc.product_id = p.id::text
  where p.id::text = p_product_id
  for update of p;

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
    unit_cost,
    payment_method,
    payment_status,
    payment_received_at,
    sold_at,
    notes,
    created_by
  ) values (
    p_product_id,
    v_product.name,
    p_quantity,
    p_unit_price,
    v_product.unit_cost,
    p_payment_method,
    p_payment_status,
    case when p_payment_status = 'paid' then coalesce(p_sold_at, now()) else null end,
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
  set
    payment_status = 'paid',
    payment_method = p_payment_method,
    payment_received_at = coalesce(payment_received_at, now())
  where id = p_sale_id and voided_at is null
  returning * into v_sale;

  if not found then
    raise exception 'Venda não encontrada ou já cancelada.';
  end if;
  return v_sale;
end;
$$;

revoke all on function public.financial_business_date(timestamptz) from public, anon, authenticated;
revoke all on function public.get_financial_metrics(date, date) from public, anon, authenticated;
revoke all on function public.create_financial_closure(text, date, date, uuid) from public, anon, authenticated;
revoke all on function public.register_sale(text, integer, numeric, text, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function public.settle_sale(uuid, text) from public, anon, authenticated;

grant execute on function public.financial_business_date(timestamptz) to service_role;
grant execute on function public.get_financial_metrics(date, date) to service_role;
grant execute on function public.create_financial_closure(text, date, date, uuid) to service_role;
grant execute on function public.register_sale(text, integer, numeric, text, text, timestamptz, text, uuid) to service_role;
grant execute on function public.settle_sale(uuid, text) to service_role;
