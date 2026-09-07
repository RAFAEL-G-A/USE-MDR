# USE MDR Capabilities

O manifesto legível pela R48 está em `r48.manifest.json`. A USE MDR continua autônoma: nenhuma capability depende da disponibilidade da R48.

| name | version | description | dependencies | frontend | backend | database | storage | edge_functions | tests | public_contracts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin-auth | 1.0.0 | Login administrativo com OTP por sessão | Supabase Auth | `AdminAccessGate` | Auth e OTP | desafios e sessões | — | request/verify/check admin | session, security | Supabase Auth |
| catalog | 1.0.0 | Consulta, busca e paginação | products, categories | home e catálogo | consultas server-side | products | products público | — | catalog, storefront | rotas públicas |
| products | 1.0.0 | Cadastro e manutenção | admin-auth, categories, image-management | formulários admin | validação e coordenação | products, product_costs | products | create/manage-product | security, images | catálogo público |
| inventory | 1.0.0 | Estoque e baixas | products, sales | painel de estoque | RPCs de venda | products, sales | — | manage-product, manage-sales | sales integrity | — |
| cart | 1.0.0 | Carrinho persistido | products | provider e página | — | — | — | — | storefront | localStorage |
| favorites | 1.0.0 | Favoritos persistidos | products | provider e página | — | — | — | — | storefront | localStorage |
| whatsapp | 1.0.0 | Preparação do pedido | cart, analytics | resumo e link | — | — | — | track-store-event | storefront | URL WhatsApp |
| sales | 1.0.0 | Venda, recebimento, cancelamento e correção | admin-auth, inventory | painel | RPCs transacionais | sales, revisions | — | manage-sales | sales, integrity | — |
| finance | 1.0.0 | Custos, despesas e fechamentos | sales, analytics | painel | RPCs e cron | tabelas financeiras | — | manage-finances, reports | finance, time | — |
| analytics | 1.0.0 | Jornada anônima até WhatsApp | catalog, whatsapp | tracker e painel | agregação | analytics events | — | track/manage-analytics | analytics | track-store-event |
| categories | 1.0.0 | Taxonomia dinâmica | admin-auth | catálogo e painel | RPCs | categories/subcategories | products/categories | manage-catalog-categories | taxonomy | leitura pública |
| hero | 1.0.0 | Destaques da home | admin-auth, image-management | carrossel e painel | coordenação | hero_slides | products/hero | manage-hero-slide | hero | leitura pública |
| image-management | 1.0.0 | Compressão, upload e limpeza | admin-auth | compressão WebP | validação | product_images | products | funções de imagem | images | URLs públicas |

## Evolução incremental proposta

1. Manter o manifesto como contrato estável.
2. Adicionar schemas de entrada compartilhados sem mover regras comerciais.
3. Extrair contratos por capability somente quando houver uma necessidade real.
4. Fazer a R48 consumir manifesto e health check, nunca a segurança interna da loja.
