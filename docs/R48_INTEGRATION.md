# Integração USE MDR e R48

## Limite arquitetural

- USE MDR é a fonte das regras comerciais e de segurança.
- R48 observa, valida compatibilidade, registra estado e prepara releases.
- Indisponibilidade da R48 não pode afetar storefront, painel, vendas, estoque ou finanças.
- Nenhuma credencial deve aparecer no manifesto ou na resposta pública de saúde.

## Contratos disponíveis

- `r48.manifest.json`: loja, arquitetura, versão do app e capabilities.
- `GET /api/health`: `{ "status": "ok", "version": "0.1.0", "services": { "app": "ok" } }`.

O health público não consulta banco ou Storage para evitar amplificação de tráfego. Uma checagem detalhada futura deverá ser protegida server-to-server.

| Condição | Estado R48 |
| --- | --- |
| HTTP 2xx e payload válido | ONLINE |
| HTTP 2xx com serviço degradado | DEGRADED |
| Timeout, DNS ou conexão recusada | OFFLINE |
| Payload incompatível ou primeira checagem pendente | UNKNOWN |

A R48 deve guardar somente status, última checagem, latência, versão e estados básicos. Não deve persistir autorização, cookies ou respostas desconhecidas.

## Pendente no R48

O consumidor, modelos de Store/Capability/Release e painel não foram implementados porque o repositório R48 Studio não está disponível nesta tarefa.
