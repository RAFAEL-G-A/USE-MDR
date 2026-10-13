# USE MDR Hardening Audit

Data do diagnóstico: 2026-09-07
Escopo auditado: `usemdr-web`
Estado do banco remoto: não verificado nesta etapa por falta de permissão de leitura no conector Supabase.

## Arquitetura encontrada

- Next.js 16.3 com App Router, React 19, TypeScript e Tailwind CSS 4.
- Aplicação empacotada para Cloudflare Workers com OpenNext.
- Supabase Auth, Data API, Storage e 13 Edge Functions.
- Storefront independente da R48, com carrinho e favoritos locais e checkout pelo WhatsApp.
- Painel administrativo protegido por Supabase Auth, e-mail administrativo, `app_metadata.role = admin`, OTP e autorização vinculada ao `session_id`.
- Cron financeiro executado pelo Worker e autenticado por um segredo server-to-server.

## Superfícies

| Classe | Superfícies |
| --- | --- |
| PUBLIC | `/`, `/catalogo`, `/produto/[id]`, `/carrinho`, `/favoritos`, leitura de catálogo e `track-store-event` |
| AUTHENTICATED | Supabase Auth, `request-admin-code`, `verify-admin-code`, `check-admin-access` |
| ADMIN | Produtos, estoque, categorias, hero, vendas, finanças, analytics e imagens |
| SERVICE | Edge Functions que usam `service_role` depois da autenticação própria |
| CRON | `custom-worker.ts` e `run-financial-reports` |
| INTERNAL | RPCs financeiras, tabelas privadas, desafios OTP e sessões verificadas |

## Riscos e recomendações

| Severidade | Risco | Arquivo relacionado | Recomendação | Requer alteração |
| --- | --- | --- | --- | --- |
| HIGH | Incremento de tentativas do OTP não era atômico e podia aceitar verificações paralelas contra o mesmo contador. | `supabase/functions/verify-admin-code/index.ts` | Corrigido com reserva condicional da tentativa e rejeição de concorrência. | Corrigido neste corte |
| HIGH | Analytics público não possui rate limit distribuído; origem e user-agent não impedem clientes externos. | `supabase/functions/track-store-event/index.ts` | Definir limitação server-side compatível com Edge e preservar a política de privacidade. | Sim, após definir o identificador seguro |
| MEDIUM | Edge Functions administrativas devolvem mensagens internas de banco e Storage. | `supabase/functions/**/index.ts` | Padronizar erros públicos e logs internos sanitizados. | Sim |
| MEDIUM | Validação de UUID, payload total e propriedades inesperadas ainda não é uniforme nas funções administrativas. | `supabase/functions/**/index.ts` | Estender de forma incremental o contrato aplicado ao analytics público. | Parcialmente corrigido |
| MEDIUM | MIME é validado pelo valor declarado, sem inspeção da assinatura do arquivo. | Funções de upload | Validar bytes iniciais antes do upload. | Sim |
| MEDIUM | A auditoria administrativa precisa ser aplicada e validada no ambiente Supabase antes de entrar em operação. | `admin_audit_logs` e Edge Functions críticas | Aplicar a migration no ambiente remoto somente após aprovação explícita. | Validada no Supabase local; promoção remota pendente |
| MEDIUM | Request IDs e logs estruturados ainda não cobrem todas as Edge Functions e o Worker. | Edge Functions e Worker | Estender o padrão já aplicado à autenticação administrativa e ao analytics público. | Parcialmente corrigido |
| MEDIUM | Operações que combinam Storage e banco dependem de compensações manuais. | `create-product`, `manage-product` | Documentar invariantes e testar falhas intermediárias antes de refatorar. | Sim, incremental |
| MEDIUM | Testes de segurança são principalmente estruturais e não executam negações reais. | `tests/admin-api-security.test.ts` | Adicionar integração isolada para token ausente, inválido, usuário comum, OTP e sessão. | Sim |
| MEDIUM | Catálogo carrega até 500 produtos para filtrar em memória. | `app/catalogo/page.tsx` | Medir e migrar filtros/paginação para consulta sem alterar UX. | Sim, após medição |
| MEDIUM | Imagens locais individuais chegam a aproximadamente 2,2 MB. | `public/images` | Converter e dimensionar com comparação visual. | Sim, após validação visual |
| LOW | Documentação do OTP diverge do código. | `SECURITY.md` | Confirmar configuração remota e atualizar apenas a documentação. | Sim; não alterar duração |
| LOW | Build alerta sobre raiz do Turbopack. | `next.config.ts` | Definir `turbopack.root` somente após validar OpenNext. | A avaliar |

## Controles positivos encontrados

- `service_role`, credenciais de e-mail, OTP pepper e cron secret não são variáveis públicas.
- `.env.local` está ignorado pelo Git.
- Tabelas financeiras, analytics, desafios OTP e sessões verificadas são revogadas de `anon` e `authenticated` nas migrations.
- RPCs privilegiadas têm `EXECUTE` revogado do público e concedido ao `service_role`.
- Funções administrativas repetem autenticação, papel administrativo e sessão OTP no servidor.
- Uploads usam caminhos aleatórios, lista de MIME e limite individual de 5 MB.
- Vendas e correções importantes usam funções transacionais no Postgres.

## Alterações deste corte

- Headers globais de segurança com CSP compatível com Supabase e Cloudflare.
- HSTS somente em produção.
- Health check público mínimo em `/api/health`.
- Scripts `typecheck` e `quality`.
- Testes para headers e health check.
- Reserva atômica por comparação para impedir reutilização concorrente do mesmo contador de OTP.
- Manifesto de capabilities e contrato de integração observável pela R48.
- Scanner explícito de secrets para arquivos enviados ao navegador.
- Request ID e `Cache-Control: no-store` em respostas administrativas.
- Analytics público com JSON obrigatório, limite de 2 KiB, rejeição de campos inesperados, request ID e log de falha sem PII.
- Error boundary sanitizada e estados acessíveis nos seletores do painel.
- Gate de CI sem deploy, usando apenas placeholders públicos e executando `npm ci` seguido de `npm run quality`.
- Migration local de `admin_audit_logs`, fechada para clientes públicos, e helper não bloqueante usado nas ações administrativas críticas.
- Cadeia histórica de migrations tornada reproduzível: a tabela `products`, antes criada manualmente, passou a ter base idempotente; a revogação opcional de `rls_auto_enable()` deixou de falhar quando a função não existe.
- Banco Supabase local reconstruído do zero com todas as 21 migrations; lint do schema sem erros.
- RLS e grants de auditoria exercitados no Postgres: `anon` e `authenticated` bloqueados, `service_role` autorizado, constraints de resultado/metadata confirmadas.
- Helper de auditoria exercitado com falha simulada de persistência, sem propagação para a operação administrativa.

## Restrições preservadas

- A duração da autorização administrativa não foi alterada: o valor existente e testado continua em 5 horas.
- Nenhum secret foi exibido, movido ou transformado em variável pública.
- Nenhuma migration, deploy, merge ou alteração no banco remoto foi executada.
- `usemdr-app` permaneceu intocado.
