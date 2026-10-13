# Security Changelog

## 2026-09-07

- Adicionados CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, proteção contra framing e políticas auxiliares.
- HSTS configurado somente para builds de produção.
- Adicionado health check público mínimo e cacheável em `/api/health`.
- Corrigida concorrência no contador de tentativas do OTP com atualização condicional.
- Adicionado scanner preventivo de secrets em arquivos públicos.
- Adicionados request ID e `no-store` às respostas administrativas.
- A entrada pública de analytics agora exige JSON, limita o corpo a 2 KiB, rejeita campos inesperados e devolve um identificador de requisição sem registrar payload, visitante ou sessão.
- Adicionada tela de erro administrativa sanitizada e melhorias ARIA simples.
- Adicionados testes de headers, health check, manifesto e reserva de tentativa OTP.
- Adicionados scripts `typecheck`, `security:scan` e `quality`.
- Adicionado workflow de CI somente para validação, sem deploy e sem credenciais reais.
- Preparada migration de auditoria administrativa e helper não bloqueante para produtos, estoque, vendas, finanças, hero, categorias, imagens e verificação administrativa.
- Validada a auditoria em Supabase local: replay completo de 21 migrations, lint sem erros, negação real para clientes e acesso do `service_role`.
- Versionada a base idempotente da tabela `products`, que antes existia apenas no ambiente remoto, e tornada condicional a revogação da função opcional `rls_auto_enable()`.
- Adicionados testes Deno do helper para falha não bloqueante, remoção de segredos e limite de strings.
- Documentadas matriz RLS, capabilities, integração R48, UX administrativa e performance.

Não houve mudança na duração da autorização administrativa (5 horas), em secrets, banco remoto, identidade visual ou comportamento comercial. A migration de auditoria foi aplicada somente ao banco local descartável e ainda não foi promovida ao ambiente remoto.
