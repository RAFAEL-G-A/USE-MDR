-- Alinha a data comercial ao novo fechamento da loja:
-- segunda a sexta às 18h em America/Recife; sábado permanece às 13h.
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
  if v_iso_day between 1 and 5 and v_time >= time '18:00' then
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
