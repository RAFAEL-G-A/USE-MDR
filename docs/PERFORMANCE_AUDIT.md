# USE MDR Performance Audit

| Severidade | Achado | Evidência | Recomendação |
| --- | --- | --- | --- |
| HIGH | Imagens locais grandes | arquivos entre aproximadamente 1,3 MB e 2,2 MB | Gerar WebP/AVIF dimensionado e comparar visualmente. |
| MEDIUM | Catálogo busca até 500 registros e filtra em memória | `app/catalogo/page.tsx` | Migrar filtros e paginação para Supabase após teste de equivalência. |
| MEDIUM | Home força renderização dinâmica | `app/page.tsx` | Medir atualização esperada e avaliar revalidação curta. |
| MEDIUM | Configuração, hero e produtos fazem consultas independentes | loaders em `lib/` | Manter paralelismo e medir cache/repetição no Worker. |
| LOW | 27 módulos são Client Components | `components/` e `lib/` | Revisar por fluxo, sem conversão mecânica. |
| LOW | Prefetch está desativado | teste `no-next-prefetch` | Preservar enquanto reduz invocações; medir impacto de UX. |

## Controles positivos

- Consultas independentes da home usam `Promise.all`.
- `next/image` é usado com `sizes` responsivo.
- Imagens administrativas são comprimidas para WebP no navegador.
- Assets estáticos possuem cache imutável.
- O health check é estático e cacheável, sem consulta ao Supabase.

Nenhuma otimização visual ou de consulta foi aplicada porque exige medição e validação do catálogo.
