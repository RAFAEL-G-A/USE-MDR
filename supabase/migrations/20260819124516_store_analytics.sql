-- Métricas anônimas e enxutas da jornada catálogo -> WhatsApp.
-- Nenhuma informação pessoal, IP ou conteúdo do pedido é armazenado.

create table if not exists public.store_analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('session_started', 'whatsapp_checkout')),
  visitor_id uuid not null,
  session_id uuid not null,
  page_path text not null check (char_length(page_path) between 1 and 200 and left(page_path, 1) = '/'),
  cart_item_count smallint check (cart_item_count between 1 and 500),
  cart_total numeric(12, 2) check (cart_total >= 0 and cart_total <= 1000000),
  created_at timestamptz not null default now(),
  constraint store_analytics_event_payload_check check (
    (event_type = 'session_started' and cart_item_count is null and cart_total is null)
    or
    (event_type = 'whatsapp_checkout' and cart_item_count is not null and cart_total is not null)
  ),
  constraint store_analytics_session_event_unique unique (session_id, event_type)
);

create index if not exists store_analytics_events_created_at_idx
  on public.store_analytics_events (created_at desc);

create index if not exists store_analytics_events_type_created_at_idx
  on public.store_analytics_events (event_type, created_at desc);

alter table public.store_analytics_events enable row level security;
revoke all on table public.store_analytics_events from public, anon, authenticated;
grant select, insert on table public.store_analytics_events to service_role;
grant usage, select on sequence public.store_analytics_events_id_seq to service_role;

create or replace function public.get_store_analytics(
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_visitors bigint := 0;
  v_sessions bigint := 0;
  v_whatsapp_clicks bigint := 0;
  v_checkout_visitors bigint := 0;
  v_cart_items bigint := 0;
  v_cart_value numeric(14, 2) := 0;
  v_conversion numeric(7, 2) := 0;
  v_series jsonb := '[]'::jsonb;
begin
  if p_period_start is null or p_period_end is null
    or p_period_end < p_period_start
    or p_period_end - p_period_start > 366 then
    raise exception 'Período de métricas inválido.';
  end if;

  v_start := p_period_start::timestamp at time zone 'America/Recife';
  v_end := (p_period_end + 1)::timestamp at time zone 'America/Recife';

  select
    count(distinct visitor_id) filter (where event_type = 'session_started'),
    count(*) filter (where event_type = 'session_started'),
    count(*) filter (where event_type = 'whatsapp_checkout'),
    count(distinct visitor_id) filter (where event_type = 'whatsapp_checkout'),
    coalesce(sum(cart_item_count) filter (where event_type = 'whatsapp_checkout'), 0),
    coalesce(sum(cart_total) filter (where event_type = 'whatsapp_checkout'), 0)
  into v_visitors, v_sessions, v_whatsapp_clicks, v_checkout_visitors, v_cart_items, v_cart_value
  from public.store_analytics_events
  where created_at >= v_start and created_at < v_end;

  if v_sessions > 0 then
    v_conversion := round((v_whatsapp_clicks::numeric / v_sessions::numeric) * 100, 2);
  end if;

  with filtered_events as materialized (
    select event_type, visitor_id, created_at
    from public.store_analytics_events
    where created_at >= v_start and created_at < v_end
  ), daily as (
    select
      day::date as date,
      count(distinct event.visitor_id) filter (where event.event_type = 'session_started')::integer as visitors,
      count(*) filter (where event.event_type = 'session_started')::integer as sessions,
      count(*) filter (where event.event_type = 'whatsapp_checkout')::integer as whatsapp_clicks
    from generate_series(p_period_start::timestamp, p_period_end::timestamp, interval '1 day') as days(day)
    left join filtered_events event
      on (event.created_at at time zone 'America/Recife')::date = day::date
    group by day::date
    order by day::date
  )
  select coalesce(jsonb_agg(to_jsonb(daily) order by date), '[]'::jsonb)
  into v_series
  from daily;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'visitors', v_visitors,
      'sessions', v_sessions,
      'whatsapp_clicks', v_whatsapp_clicks,
      'checkout_visitors', v_checkout_visitors,
      'conversion_rate', v_conversion,
      'cart_items', v_cart_items,
      'cart_value', round(v_cart_value, 2)
    ),
    'series', v_series
  );
end;
$$;

revoke all on function public.get_store_analytics(date, date) from public, anon, authenticated;
grant execute on function public.get_store_analytics(date, date) to service_role;
