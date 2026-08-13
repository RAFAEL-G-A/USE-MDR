# USE MDR — Catálogo Web

Catálogo responsivo da USE MDR, criado com prioridade para celulares e pensado
para clientes que chegam pelo Instagram e WhatsApp.

[Visitar o catálogo da USE MDR](https://use-mdr-beauty-preview.usemdr-web.workers.dev/catalogo)

## Sobre o projeto

A experiência combina a identidade feminina e sofisticada da USE MDR com uma
navegação simples: a cliente encontra os produtos, salva seus favoritos, monta
o carrinho e envia o pedido completo pelo WhatsApp.

Não é necessário criar conta, preencher cadastro ou passar por um checkout
tradicional.

## Experiência da cliente

- Home editorial com carrossel de campanhas;
- catálogo integrado ao Supabase;
- categorias e subcategorias de produtos;
- busca por nome;
- páginas individuais dos produtos;
- favoritos salvos no próprio dispositivo;
- carrinho com alteração de quantidades e total automático;
- pedido formatado com itens, quantidades, subtotais e total para o WhatsApp;
- seção de lançamentos que se adapta à quantidade disponível;
- acesso direto ao Instagram e ao WhatsApp da loja;
- layout mobile-first, com adaptação completa para telas maiores.

## Identidade visual

O projeto preserva a linguagem da marca USE MDR:

- rosa sofisticado e fundos claros;
- tipografia editorial;
- cantos arredondados e sombras suaves;
- cards com destaque para as fotografias dos produtos;
- cabeçalho e rodapé compactos;
- navegação inferior confortável no celular.

As imagens promocionais e os conceitos visuais podem ser desenvolvidos com
apoio de inteligência artificial, mantendo a identidade definida para a loja.

## Novidades

O histórico das ideias que deram forma ao catálogo está em
[NOVIDADES.md](NOVIDADES.md).

## Tecnologias

- Next.js, React e TypeScript;
- Tailwind CSS;
- Supabase Postgres e Storage;
- Cloudflare Workers;
- Netlify mantida como ambiente alternativo;
- armazenamento local do navegador para carrinho e favoritos.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Copie `.env.example` para `.env.local` e configure somente as variáveis
necessárias ao ambiente local. Arquivos `.env` não são versionados.

## Privacidade e segurança

O repositório não publica e-mails administrativos, tokens, senhas ou chaves
privadas. A apresentação pública do projeto aponta exclusivamente para o
catálogo destinado às clientes.
