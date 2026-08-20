# USE MDR — Catálogo Web

Loja virtual responsiva da **USE MDR**, criada para apresentar produtos de
beleza e transformar o carrinho em um pedido organizado pelo WhatsApp.

[Visitar o catálogo da USE MDR](https://use-mdr-beauty-preview.usemdr-web.workers.dev/catalogo)

[Implementações e correções](IMPLEMENTACOES.md) · [Histórico de novidades](NOVIDADES.md)

> Projeto web independente do aplicativo mobile anterior. O produto final é um
> site responsivo e não gera APK.

## Visão do projeto

A experiência combina a identidade feminina, sofisticada e editorial da USE
MDR com uma jornada de compra simples. A cliente navega pelo catálogo, encontra
os produtos, salva favoritos, monta o carrinho e envia o pedido completo para a
loja pelo WhatsApp.

Não é necessário criar conta, preencher cadastro, informar dados de pagamento
ou passar por um checkout tradicional.

## Experiência da cliente

- Home editorial com carrossel de até quatro campanhas;
- catálogo integrado ao Supabase;
- categorias e subcategorias de produtos;
- busca por nome e filtros de navegação;
- paginação com 15 produtos por página;
- páginas individuais com descrição formatada e galeria de imagens;
- favoritos e carrinho preservados no próprio navegador;
- alteração de quantidades e cálculo automático do total;
- pedido para o WhatsApp com produtos, quantidades, subtotais e total;
- seção de lançamentos adaptável à quantidade disponível;
- acesso direto às redes sociais e informações da loja;
- interface mobile-first com composição própria para telas maiores.

## Gestão da loja

O projeto inclui uma área administrativa protegida, desenvolvida para organizar
a operação sem expor dados internos no catálogo público.

- **Estoque:** cadastro, edição e exclusão de produtos, valores, quantidades,
  categorias, subcategorias e imagens;
- **Vendas:** venda única ou agrupada, pesquisa de produtos, descontos,
  diferentes formas de pagamento e correção posterior com histórico;
- **Destaques:** gerenciamento do carrossel, lançamentos e imagens das
  categorias;
- **Finanças:** receitas, despesas, recebimentos, produtos mais vendidos,
  fechamento por período e relatórios;
- **Métricas:** visitantes anônimos, sessões, carrinhos levados ao WhatsApp e
  taxa de conversão.

As imagens enviadas pelo painel são validadas, redimensionadas, comprimidas e
convertidas automaticamente para WebP. Fotos substituídas também podem ser
removidas do Storage para evitar acúmulo desnecessário.

## Privacidade e segurança

- O catálogo não exige login das clientes;
- favoritos e carrinho ficam armazenados localmente no dispositivo;
- as métricas não registram nome, telefone, e-mail, IP ou mensagem do pedido;
- operações administrativas são verificadas no servidor;
- o acesso administrativo utiliza autenticação e uma segunda verificação;
- tabelas internas são protegidas por regras de acesso no banco;
- chaves privadas, senhas, tokens e e-mails administrativos não são
  versionados;
- arquivos `.env` permanecem fora do Git por meio do `.gitignore`.

Este repositório apresenta publicamente o catálogo e sua arquitetura, mas não
publica credenciais nem links de acesso administrativo.

## Identidade visual

O projeto preserva a linguagem da marca USE MDR:

- rosa sofisticado, rose gold e fundos claros;
- tipografia editorial combinada com uma fonte moderna;
- bastante espaço em branco;
- cantos arredondados e sombras suaves;
- cards com destaque para as fotografias dos produtos;
- navegação confortável no celular e melhor uso da largura no desktop.

## Arquitetura

- **Next.js 16**, React e TypeScript;
- **Tailwind CSS** para a interface responsiva;
- **Supabase Postgres** para catálogo, estoque, vendas e informações
  administrativas;
- **Supabase Storage** para imagens dos produtos e campanhas;
- **Supabase Auth e Edge Functions** para operações administrativas protegidas;
- **Cloudflare Workers** para hospedagem da aplicação web;
- armazenamento local do navegador para carrinho, favoritos e controle anônimo
  de sessão.

## Qualidade e testes

O projeto possui verificações automatizadas para:

- TypeScript, lint e build de produção;
- catálogo, categorias e paginação;
- carrinho e pedido pelo WhatsApp;
- vendas únicas, agrupadas, descontos e integridade do estoque;
- horários comerciais e fechamentos financeiros;
- formatos de imagem e conversão para WebP;
- segurança das APIs administrativas;
- métricas anônimas e controle de duplicidade;
- responsividade dos principais componentes administrativos.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Copie `.env.example` para `.env.local` e configure somente as variáveis
necessárias ao ambiente local. Nunca envie o `.env.local` ao GitHub.

Comandos principais:

```bash
npm run lint
npm run test:all
npm run build
```

## Evolução do projeto

As entregas técnicas estão organizadas em
[IMPLEMENTACOES.md](IMPLEMENTACOES.md), enquanto as ideias e novidades da loja
são apresentadas cronologicamente em [NOVIDADES.md](NOVIDADES.md).

## Escopo atual

O projeto foi planejado como catálogo e ferramenta de apoio à loja. Nesta fase,
ele não inclui gateway de pagamento, checkout tradicional, cadastro obrigatório
de clientes, perfil público de usuário ou aplicativo para lojas mobile.

---

**USE MDR — Maquiagens e acessórios**
