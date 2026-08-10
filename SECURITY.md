# Segurança da USE MDR Beauty

## Princípio de acesso

O site e seu código são públicos. A segurança do inventário não depende de uma
URL escondida: ela é aplicada no Supabase por autenticação, Edge Functions e
políticas de Row Level Security (RLS).

Clientes anônimos podem apenas consultar produtos. Somente a conta marcada com
o papel `admin` pode iniciar o fluxo de gravação.

## Dupla camada administrativa

Para cadastrar, alterar ou excluir produtos e imagens, a sessão precisa cumprir
simultaneamente os seguintes requisitos:

1. autenticação válida por e-mail e senha no Supabase Auth;
2. código aleatório de seis dígitos enviado exclusivamente ao e-mail definido
   no secret `ADMIN_EMAIL`.

O código:

- é gerado com fonte criptograficamente segura;
- é armazenado somente como HMAC-SHA-256, nunca em texto aberto;
- vence em 10 minutos;
- permite no máximo 5 tentativas;
- possui intervalo mínimo de 60 segundos entre envios;
- limita a 5 solicitações por hora;
- é consumido depois do primeiro uso correto.

Depois da confirmação, a autorização dura 30 minutos e é vinculada ao
`session_id` do token. Uma nova sessão exige um novo código.

## Proteção da API e do Storage

As políticas RLS exigem o papel administrativo, a sessão verificada e uma
autorização ainda válida. A mesma regra protege a tabela `products` e as
operações de catálogo e carrossel no bucket `products`.

O navegador não grava diretamente no banco. O formulário chama apenas a Edge
Functions `create-product` e `manage-hero-slide`, que repetem as verificações
administrativas no servidor, validam os campos e coordenam uploads e gravações.
Assim, uma operação não fica parcialmente concluída quando o banco rejeita os
dados.

A chave pública do Supabase pode aparecer no navegador; ela não concede
privilégios administrativos. Chaves secretas, credenciais de e-mail e o
`OTP_PEPPER` devem existir somente nos Secrets das Edge Functions e nunca no
GitHub ou em variáveis `NEXT_PUBLIC_*`.

## Serviços envolvidos

- Supabase Auth: primeira camada e gerenciamento da sessão;
- Supabase Edge Functions: geração, envio e verificação do código;
- API `create-product`: cadastro coordenado do produto e da imagem;
- API `manage-hero-slide`: gerenciamento dos destaques da página inicial;
- Resend: entrega do e-mail transacional;
- Supabase RLS: decisão final de autorização para banco e Storage.
