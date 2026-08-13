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
  if p_period_type not in ('daily', 'weekly', 'monthly') then
    raise exception 'Tipo de fechamento inválido.';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Período de fechamento inválido.';
  end if;

  v_duration := p_period_end - p_period_start + 1;
  v_previous_end := p_period_start - 1;
  v_previous_start := v_previous_end - (v_duration - 1);
  v_metrics := public.get_financial_metrics(p_period_start, p_period_end)
    || jsonb_build_object(
      'previous_metrics', public.get_financial_metrics(v_previous_start, v_previous_end),
      'previous_period_start', v_previous_start,
      'previous_period_end', v_previous_end
    );

  insert into public.financial_closures (
    period_type, period_start, period_end, metrics, generated_by
  ) values (
    p_period_type, p_period_start, p_period_end, v_metrics, p_generated_by
  )
  on conflict (period_type, period_start, period_end)
  do update set id = public.financial_closures.id
  returning * into v_closure;

  return v_closure;
end;
$$;

revoke all on function public.create_financial_closure(text, date, date, uuid) from public, anon, authenticated;
grant execute on function public.create_financial_closure(text, date, date, uuid) to service_role;
