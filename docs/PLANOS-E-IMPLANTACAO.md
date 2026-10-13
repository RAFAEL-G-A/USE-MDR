# Planos e implantação comercial da USE MDR

## Modelo recomendado agora

Cada cliente deve receber uma implantação isolada: um Worker da Cloudflare, um
projeto Supabase e suas próprias variáveis de ambiente. A base de código é
reutilizável, mas catálogo, imagens, funcionários, vendas e métricas não são
misturados entre lojas.

Esse formato permite vender a solução antes de concluir uma plataforma
multitenant central. A R48 Engine poderá automatizar o provisionamento depois,
sem bloquear os primeiros clientes.

## Separação sugerida dos planos

| Recurso | Essencial | Gestão | Equipe |
| --- | --- | --- | --- |
| Catálogo, categorias e subcategorias | Sim | Sim | Sim |
| Favoritos, carrinho e pedido no WhatsApp | Sim | Sim | Sim |
| Lançamentos, destaques e promoções | Sim | Sim | Sim |
| Estoque e vendas | Sim | Sim | Sim |
| Aquisições e custo médio ponderado | Não | Sim | Sim |
| Finanças e fechamento por e-mail | Não | Sim | Sim |
| Métricas da jornada até o WhatsApp | Não | Sim | Sim |
| Funcionários, papéis e auditoria | Não | Não | Sim |

Os nomes e preços comerciais ainda podem mudar. A regra técnica importante é
que um plano nunca habilite uma função sem suas dependências. Finanças depende
de vendas; aquisições depende de estoque; equipe depende de autenticação, OTP e
auditoria.

## Papéis administrativos

| Papel | Áreas liberadas |
| --- | --- |
| Operador | Vendas |
| Gerente | Vendas, Estoque, Aquisições, Categorias, Destaques e Métricas |
| Proprietária | Todas as áreas, incluindo Finanças e Usuários |

A navegação exibe somente as áreas permitidas. A mesma matriz é aplicada nas
Edge Functions, portanto esconder um botão não é a única proteção.

## Checklist de implantação de um novo cliente

1. Formalizar plano, mensalidade, implantação, suporte e política de
   cancelamento.
2. Coletar nome da loja, identidade visual, domínio, WhatsApp, redes sociais,
   horário e e-mail administrativo.
3. Criar projeto Supabase exclusivo e aplicar todas as migrations versionadas.
4. Criar buckets, políticas de acesso e segredos sem copiar credenciais da USE
   MDR.
5. Configurar domínio autenticado no Resend e remetente transacional.
6. Criar a conta Proprietária e validar o OTP de acesso.
7. Criar Worker exclusivo, variáveis e domínio da loja na Cloudflare.
8. Importar catálogo inicial com fotos otimizadas e conferir quantidades.
9. Testar no celular e desktop: catálogo, promoção, carrinho, WhatsApp, venda,
   aquisição, custo médio, fechamento, usuários e permissões.
10. Registrar aceite do cliente e manter um backup local da versão entregue.

## O que ainda separa a base de uma plataforma multitenant

- cadastro central de clientes, lojas, planos e limites;
- provisionamento automatizado de Supabase, Worker, domínio e segredos;
- painel mestre para suporte e situação das implantações;
- cobrança recorrente, suspensão e reativação de plano;
- personalização completa de marca e textos sem alteração de código;
- termos de uso, privacidade, suporte, SLA e procedimento de saída/exportação;
- monitoramento consolidado de consumo e alertas por loja.

Esses itens não impedem a venda da implantação isolada. Eles são necessários
antes de vender a solução como SaaS multitenant de autoatendimento.

## Critérios de liberação

Uma nova versão só deve ser publicada quando lint, TypeScript, testes, varredura
de segredos, build Next.js, build Cloudflare e verificações das rotas forem
aprovados. Migrações e funções devem ser aplicadas apenas no projeto Supabase
identificado para aquela loja.
