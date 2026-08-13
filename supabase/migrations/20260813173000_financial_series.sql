create or replace function public.get_financial_series(
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series jsonb;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Período financeiro inválido.';
  end if;

  if p_period_end - p_period_start > 370 then
    raise exception 'O período máximo da série é de 370 dias.';
  end if;

  with days as (
    select generate_series(p_period_start, p_period_end, interval '1 day')::date as business_date
  ),
  sales_by_day as (
    select
      public.financial_business_date(sold_at) as business_date,
      sum(total_amount) as revenue,
      sum(total_cost) as cost,
      count(*)::integer as orders
    from public.sales
    where voided_at is null
      and public.financial_business_date(sold_at) between p_period_start and p_period_end
    group by 1
  ),
  expenses_by_day as (
    select
      public.financial_business_date(occurred_at) as business_date,
      sum(amount) as expenses
    from public.expenses
    where status = 'paid'
      and public.financial_business_date(occurred_at) between p_period_start and p_period_end
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', days.business_date,
        'revenue', round(coalesce(sales_by_day.revenue, 0), 2),
        'cost', round(coalesce(sales_by_day.cost, 0), 2),
        'expenses', round(coalesce(expenses_by_day.expenses, 0), 2),
        'net_profit', round(
          coalesce(sales_by_day.revenue, 0)
          - coalesce(sales_by_day.cost, 0)
          - coalesce(expenses_by_day.expenses, 0),
          2
        ),
        'orders', coalesce(sales_by_day.orders, 0)
      ) order by days.business_date
    ),
    '[]'::jsonb
  )
  into v_series
  from days
  left join sales_by_day using (business_date)
  left join expenses_by_day using (business_date);

  return v_series;
end;
$$;

revoke all on function public.get_financial_series(date, date) from public, anon, authenticated;
grant execute on function public.get_financial_series(date, date) to service_role;
