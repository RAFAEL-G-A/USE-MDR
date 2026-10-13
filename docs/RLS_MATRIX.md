# USE MDR RLS Matrix

Esta matriz descreve as migrations versionadas no repositório. Ela deve ser comparada com o banco remoto antes de qualquer correção, pois o conector Supabase não concedeu permissão de leitura durante a auditoria de 2026-09-07.

Legenda: `ALLOW` = permitido por grant e policy; `DENY` = revogado ou sem policy; `SERVICE` = operação reservada ao `service_role`.

| Recurso | Operação | anon | authenticated | admin | service_role |
| --- | --- | --- | --- | --- | --- |
| `products` | SELECT | ALLOW | ALLOW | ALLOW | ALLOW |
| `products` | INSERT/UPDATE/DELETE | DENY | Condicional por claims legadas de inventário | Condicional | ALLOW |
| `hero_slides` | SELECT | ALLOW | ALLOW | ALLOW | ALLOW |
| `hero_slides` | INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `category_images` | SELECT | ALLOW | ALLOW | ALLOW | ALLOW |
| `category_images` | INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `product_images` | SELECT | ALLOW | ALLOW | ALLOW | ALLOW |
| `product_images` | INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `catalog_categories` | SELECT ativo | ALLOW | ALLOW | ALLOW | ALLOW |
| `catalog_subcategories` | SELECT de categoria ativa | ALLOW | ALLOW | ALLOW | ALLOW |
| `catalog_categories`, `catalog_subcategories` | Escrita | DENY | DENY | Via Edge Function/RPC | ALLOW |
| `sales` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function/RPC | ALLOW |
| `product_costs` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `expenses` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `financial_closures` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function/RPC | ALLOW |
| `financial_report_settings` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `financial_job_runs` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via cron | ALLOW |
| `sale_order_revisions` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function/RPC | ALLOW |
| `store_analytics_events` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Métricas via Edge Function | SELECT/INSERT |
| `admin_email_challenges` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `admin_verified_sessions` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | ALLOW |
| `admin_audit_logs` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function | SELECT/INSERT |
| `catalog_change_log` | SELECT/INSERT/UPDATE/DELETE | DENY | DENY | Via Edge Function/RPC | ALLOW |
| Storage `products` | Leitura de objetos | Público por configuração do bucket | Público | Público | ALLOW |
| Storage `products/catalog/*` | INSERT/UPDATE/DELETE | DENY | Condicional por claims administrativas | Condicional | ALLOW |
| Storage `products/hero/*`, `products/categories/*` | Escrita | DENY | DENY | Via Edge Function | ALLOW |

## Funções `SECURITY DEFINER`

As migrations revogam do público as RPCs financeiras, de vendas, analytics e catálogo e concedem execução ao `service_role`. As funções mais recentes usam `search_path = ''`; funções financeiras mais antigas usam `search_path = public` e devem ser revisadas contra o estado remoto antes de qualquer alteração.

## Pontos que exigem confirmação remota

- Policies e grants efetivamente aplicados hoje.
- Existência de policies antigas que não aparecem nas migrations atuais.
- Exposição atual das tabelas na Data API.
- Configuração real do bucket e policies de `storage.objects`.
- Versões implantadas das 13 Edge Functions.
- Advisors de segurança e performance do Supabase.
