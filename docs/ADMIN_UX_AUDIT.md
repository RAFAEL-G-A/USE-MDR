# USE MDR Admin UX Audit

## Estado atual

- Navegação lateral consistente e recolhível.
- Estoque concentra cadastro e edição; redirects preservam URLs antigas.
- Feedbacks de carregamento, sucesso, erro e estados vazios existem nas áreas principais.
- Exclusão de produto possui confirmação em dois passos.
- Formulários usam labels e controles nativos na maior parte do painel.

## Riscos e melhorias incrementais

| Severidade | Achado | Recomendação |
| --- | --- | --- |
| MEDIUM | Ações destrutivas não usam um padrão único de confirmação. | Criar confirmação acessível compartilhada antes de alterar telas. |
| MEDIUM | Falhas inesperadas não tinham error boundary no segmento admin. | Corrigido com recuperação e mensagem sanitizada em `app/admin/error.tsx`. |
| LOW | Algumas listas financeiras são densas em telas pequenas. | Medir com dados reais e agrupar informações secundárias. |
| LOW | Tabs e seletores visuais não expunham todos os estados ARIA. | Adicionados `aria-selected` e `aria-pressed`; navegação por setas permanece como melhoria futura. |
| LOW | Loading inicial depende de cada componente. | Avaliar `app/admin/loading.tsx` preservando feedbacks locais. |

## Home administrativa futura

A futura home pode reunir vendas de hoje, pedidos pendentes, estoque baixo, visitantes, conversão para WhatsApp, alertas e estado do sistema. Não foi implementada para evitar redesenho massivo.
