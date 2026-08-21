# Novidades — evolução do catálogo USE MDR

Este histórico mostra como novas ideias foram incorporadas ao projeto para
transformar a USE MDR em uma experiência web bonita, simples e confortável no
celular.

[Conhecer o catálogo](https://use-mdr-beauty-preview.usemdr-web.workers.dev/catalogo)

## 7 de agosto de 2026 — o catálogo ganhou sua versão web

- Criação do projeto em Next.js, separado do aplicativo mobile anterior.
- Desenvolvimento com prioridade para telas em modo retrato.
- Home inspirada na identidade rosa, feminina e editorial da USE MDR.
- Estrutura inicial de categorias, busca, favoritos e carrinho.
- Finalização do pedido diretamente pelo WhatsApp, sem login e sem checkout
  tradicional.
- Integração do catálogo e das imagens com o Supabase.

## 10 de agosto de 2026 — identidade renovada e conteúdo mais dinâmico

- Aplicação da nova marca USE MDR no cabeçalho.
- Cabeçalho mais compacto, com melhor aproveitamento da tela do celular.
- Rodapé menor e mais suave, com Instagram, WhatsApp e endereço da loja.
- Fundo rosa claro alinhado ao restante da identidade visual.
- Carrossel principal com até quatro campanhas e suporte ao gesto de deslizar,
  sem setas laterais.
- Slides vazios deixaram de aparecer automaticamente.
- Imagens próprias para as categorias, com maior destaque visual.
- Área de lançamentos ampliada para até seis produtos e adaptável quando houver
  menos itens.
- Substituição da categoria Kits por Paletas para combinar melhor com o catálogo.
- Paletas promovidas a categoria principal, evitando repetição na seção Olhos.
- Correção da navegação das categorias para levar a cliente diretamente aos
  produtos filtrados.

## 13 de agosto de 2026 — nova etapa de publicação

- Preparação do Next.js para funcionar também na Cloudflare Workers.
- Publicação de uma versão online para validar o catálogo em celulares reais.
- Confirmação do carregamento dos produtos do Supabase no novo ambiente.
- Validação da Home, do carrossel, das categorias, dos lançamentos e do rodapé.
- Netlify preservada como alternativa durante a transição.
- Galeria de até quatro fotos por produto, mantendo somente a capa nos cards do
  catálogo.
- Conversão automática das novas imagens para WebP antes do envio.
- Otimização automática de toda nova foto escolhida, sem botão ou etapa manual,
  com remoção dos arquivos substituídos do Storage.
- Conversão das seis capas existentes, reduzindo o espaço total de cerca de
  1,25 MB para 203 KB, uma economia aproximada de 84%.
- Desativação do pré-carregamento automático das rotas para impedir o ciclo de
  requisições RSC identificado no ambiente Cloudflare Workers.

## 14 de agosto de 2026 — catálogo preparado para crescer

- Paginação do catálogo com 15 produtos por página.
- Troca instantânea entre páginas sem novas consultas ao Supabase ou ao Worker.
- Navegação numérica clara no desktop e seletor compacto no celular.
- Endereço da página preservado na URL, permitindo usar Voltar e Avançar no
  navegador.
- Catálogo preparado para carregar até 500 produtos em uma única consulta,
  renderizando somente os 15 itens da página atual.

## 18 de agosto de 2026 — vendas mais rápidas e painel mais seguro

- Nova área de Vendas ao lado de Estoque, Destaques e Finanças.
- Opção de registrar uma venda com um único produto ou montar um pedido com
  vários produtos.
- Venda em grupo protegida por operação atômica: se um item estiver inválido,
  nenhum produto é retirado do estoque.
- Pedidos com vários itens contabilizados como uma única venda nos indicadores
  e no cálculo do ticket médio.
- Histórico de pedidos com recebimento posterior, cancelamento e devolução
  automática das unidades ao estoque.
- Upload ampliado para fotos HEIC e HEIF do iPhone, inclusive quando o aparelho
  não informa corretamente o formato do arquivo.
- Conversor WebP alternativo em WebAssembly para contornar a ausência de
  codificação WebP no Safari do iPhone.
- Limite de entrada definido em 5 MB, mantendo a conversão e compressão
  automática para WebP antes do envio.
- Acesso administrativo simultâneo em mais de um celular ou computador, com
  código e autorização independentes por dispositivo.
- O botão Sair encerra apenas a sessão do aparelho atual e preserva os demais
  acessos administrativos autorizados.
- Manual visual da área administrativa criado sem credenciais ou dados de
  acesso.
- Revisão das permissões do banco, do histórico de migrações e das requisições
  na Cloudflare.
- Campo opcional **Valor com desconto** nas vendas únicas e em grupo, com o
  total realmente recebido refletido no histórico e nos indicadores.
- Distribuição automática do desconto entre os itens de uma venda em grupo,
  preservando centavos, custos, lucros e quantidades.
- Edição de vendas já registradas para corrigir quantidades, valores, cliente,
  data, pagamento, situação e observações.
- Correções atômicas com ajuste apenas da diferença no estoque, sem apagar ou
  duplicar a venda original.
- Histórico permanente de auditoria com valor anterior, valor corrigido,
  motivo, data, horário e administrador responsável.
- Avisos de correção no resumo financeiro e no fechamento por e-mail seguinte,
  sem contabilizar o mesmo faturamento duas vezes.
- Bateria permanente de integridade para descontos, vendas em grupo, correções,
  estoque, permissões e isolamento do catálogo.
- Histórico local de migrações alinhado ao Supabase, eliminando uma versão
  duplicada antes do próximo deploy.
- Nova subcategoria **Brumas** dentro de **Pele**, disponível no catálogo e no
  cadastro administrativo.
- Controle individual de esmaecimento nos quatro slides do carrossel, permitindo
  ligar ou desligar o degradê diretamente na área de Destaques.

## Ideias que orientam o projeto

- **Mobile-first:** a experiência nasce para o celular e depois se adapta ao
  desktop.
- **Compra simples:** a cliente escolhe os produtos e conversa com a loja pelo
  WhatsApp.
- **Sem barreiras:** catálogo, favoritos e carrinho não exigem cadastro.
- **Conteúdo vivo:** campanhas, categorias e lançamentos acompanham as novidades
  da loja.
- **Identidade própria:** cada decisão visual procura preservar o estilo da USE
  MDR, sem recorrer a uma aparência genérica de template.

Este arquivo continuará recebendo novas versões à medida que outras ideias forem
incorporadas ao catálogo.

## 19 de agosto de 2026 — carrossel e categorias reorganizados

- O botão **Explorar novidades** foi movido para baixo do carrossel para não disputar espaço com os textos das campanhas.
- O indicador dos slides agora fica fora da imagem, acima do botão **Explorar novidades**.
- A categoria **Pele** foi simplificada para Bases, Corretivos, Pós, Primers e Brumas.
- Blush, Iluminador, Contorno, Sombra e Multifuncionais agora pertencem à categoria **Paletas**.
- As subcategorias **Cílios** e **Cola de Cílios** foram adicionadas em Olhos.
- Uma migração preserva os produtos existentes e atualiza somente sua classificação no catálogo.

## 19 de agosto de 2026 — métricas da jornada até o WhatsApp

- Nova aba administrativa **Métricas**, protegida pela autenticação em duas etapas.
- Contagem anônima de visitantes, sessões e carrinhos levados ao WhatsApp.
- Taxa de conversão e gráfico diário com filtros para hoje, 7 dias e 30 dias.
- Registro limitado a uma visita e uma ida ao WhatsApp por sessão, reduzindo requisições e duplicidades.
- Nenhum nome, telefone, e-mail, IP, produto individual ou mensagem do pedido é armazenado.
- Os relatórios financeiros enviados por e-mail também passam a apresentar o resumo da jornada até o WhatsApp.

## 19 de agosto de 2026 — jornada administrativa ampliada

- A autorização da segunda verificação administrativa passa de duas para cinco horas por dispositivo.
- A sessão principal do Supabase continua sendo renovada normalmente, sem reduzir as validações realizadas no servidor.
- Cada aparelho permanece com sua própria autorização, e o botão **Sair** continua encerrando somente o acesso daquele dispositivo.

## 20 de agosto de 2026 — painel mais organizado e vendas mais rápidas

- Navegação administrativa transformada em um menu lateral recolhível no
  computador e em uma gaveta compacta no celular.
- Ícones e textos dos acessos deixaram de disputar espaço, preservando a
  leitura de Estoque, Vendas, Destaques, Finanças e Métricas.
- Pesquisa de produtos adicionada às vendas únicas e às vendas em grupo, sem
  diferenciar acentos ou letras maiúsculas.
- Correção da comunicação entre o formulário administrativo e as novas
  subcategorias **Cílios** e **Cola de Cílios**.
- Cartões de Recebimentos e Mais vendidos ajustados para manter altura,
  alinhamento e espaçamento consistentes.
- Gráfico de fluxo diário e resumo de carrinhos enviados reorganizados para
  dividir melhor a tela em monitores largos e permanecer legíveis no celular.
- Página de Métricas integrada ao menu lateral e aos relatórios financeiros
  enviados por e-mail.
- Testes ampliados para taxonomia, pesquisa de produtos, responsividade do
  painel, segurança das APIs, duração da sessão e jornada até o WhatsApp.
- Prévia local habilitada na rede da loja para testes reais em celulares antes
  da publicação.

## 21 de agosto de 2026 — novas subcategorias do catálogo

- A categoria **Acessórios** passa a oferecer Bolsa, Chapinhas, Xuxinha,
  Strass, Navalhas e Escovas.
- A categoria **Olhos** passa a oferecer Pigmentos e Glitter.
- As novas opções ficam disponíveis tanto no cadastro quanto na edição de
  produtos, mantendo a validação do site e do Supabase sincronizada.
- Nenhum produto existente, imagem, preço ou quantidade de estoque é alterado.

## 21 de agosto de 2026 — categorias administráveis

- Nova área **Categorias** no painel para criar categorias com imagem e primeira
  subcategoria.
- Inclusão de novas subcategorias sem precisar alterar o código do site.
- Troca de imagens com otimização automática em WebP e remoção do arquivo
  anterior do Storage.
- Proteção que impede remover uma subcategoria enquanto houver produtos
  vinculados a ela.
- Formulário de novo produto movido para o início do Gerenciar estoque; a lista
  de edição permanece logo abaixo.
- Catálogo, cadastro e edição passam a consultar a mesma configuração de
  categorias, com uma lista segura de reserva caso a conexão fique indisponível.
- Pesquisa rápida por categoria ou subcategoria dentro do painel.
- Contadores mostram quantos produtos existem em cada divisão do catálogo.
- Categorias podem ser ocultadas, reativadas e reposicionadas sem apagar seus
  produtos.
- Categorias e subcategorias podem ser renomeadas com atualização conjunta dos
  produtos vinculados.
- Botão de pré-visualização abre a categoria diretamente no catálogo.
- Histórico protegido registra as alterações recentes com data e horário.
