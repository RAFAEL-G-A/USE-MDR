# USE MDR Beauty — Catálogo Web

Loja virtual responsiva da USE MDR, desenvolvida para navegação principalmente pelo celular e finalização de pedidos pelo WhatsApp.

## Recursos

- catálogo conectado ao Supabase;
- categorias, subcategorias e busca;
- páginas individuais de produtos;
- favoritos sem login;
- carrinho persistente no navegador;
- alteração de quantidades, subtotais e total;
- pedido formatado automaticamente para o WhatsApp;
- layout responsivo com identidade visual própria da USE MDR.

## Tecnologias

- Next.js;
- TypeScript;
- Tailwind CSS;
- Supabase;
- `localStorage` para carrinho e favoritos.

## Executar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

O número do WhatsApp deve conter somente números, incluindo código do país e DDD.

O arquivo `.env.local` é ignorado pelo Git e não deve ser enviado ao repositório.

## Área administrativa

A página `/admin/produtos` permite cadastrar produtos e enviar imagens pelo
celular ou computador. O acesso utiliza uma conta do Supabase Auth e as
operações são protegidas por Row Level Security.

Para preparar o Supabase:

1. crie a conta da administradora em **Authentication > Users**;
2. abra `supabase/admin-catalog-setup.sql`;
3. substitua `ADMIN_EMAIL_AQUI` pelo e-mail da conta;
4. execute o arquivo no **SQL Editor** do Supabase;
5. saia e entre novamente na área administrativa para atualizar a sessão.

## Verificações

```bash
npm run lint
npm run build
```

## Hospedagem

O projeto pode ser publicado em uma plataforma compatível com Next.js. A opção gratuita considerada inicialmente é a Netlify, configurando nela as mesmas variáveis de ambiente.
