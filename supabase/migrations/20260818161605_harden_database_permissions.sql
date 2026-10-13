-- A função é usada apenas internamente pelo gatilho de DDL. Nenhum cliente da
-- API precisa executá-la diretamente.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Mantém uma única política pública de leitura do catálogo.
drop policy if exists "Public can read products" on public.products;

-- Evita varreduras na relação entre execuções de relatórios e fechamentos.
create index if not exists financial_job_runs_closure_id_idx
  on public.financial_job_runs (closure_id);
