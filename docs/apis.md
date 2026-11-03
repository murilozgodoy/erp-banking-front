# APIs, regras de negócio e modelos de dados

Todas as rotas, exceto `/health` e as de métricas, exigem `Authorization: Bearer <access token>` e a
permissão indicada (ver [auth0.md](auth0.md)). Sem token: 401; sem a permissão: 403.

## Acesso pelo API Gateway

Desde a Etapa 4 as APIs são acessadas pelo API Gateway (nginx, porta **8080**), que remove o prefixo antes de
repassar. As rotas das tabelas abaixo são as do serviço; pelo gateway, acrescente o prefixo:

| Prefixo no gateway | Serviço          | Exemplo                                                    |
| ------------------ | ---------------- | ---------------------------------------------------------- |
| `/onboarding`      | Onboarding API   | `GET /onboarding/customers?q=ana` → `GET /customers?q=ana` |
| `/score`           | Credit Score API | `GET /score/scores/strategies` → `GET /scores/strategies`  |
| `/transactions`    | Transactions API | `GET /transactions/accounts/1` → `GET /accounts/1`         |
| `/gateway/health`  | o próprio nginx  | 200 `{"status":"UP"}`                                      |

Na Vercel o front chama `/api/<prefixo>/...` (ex.: `/api/score/scores/strategies`), que o `vercel.json` reescreve
para `http://3.235.6.136:8080/<prefixo>/...`.

Respostas geradas pelo próprio gateway (JSON, sempre com o header `X-Request-ID`):

| Status | Quando                                          | Corpo                                                                  |
| ------ | ----------------------------------------------- | ---------------------------------------------------------------------- |
| 429    | mais de 50 req/s por IP (burst 100)             | `{"detail":"Too Many Requests","request_id":"..."}` + `Retry-After: 1` |
| 503    | serviço de destino fora do ar ou sem resposta   | `{"detail":"Service Unavailable","request_id":"..."}`                  |
| 404    | rota fora dos prefixos, `/metrics`, `/actuator` | `{"detail":"Not Found","request_id":"..."}`                            |

Os demais erros (400, 401, 403, 404, 409, 422...) vêm dos serviços sem alteração. Detalhes em
[etapa-4.md](etapa-4.md#api-gateway).

## Endpoints

### Onboarding API (`:8081`)

| Método | Rota                           | Permissão         | Descrição                                                                     |
| ------ | ------------------------------ | ----------------- | ----------------------------------------------------------------------------- |
| GET    | `/customers?q=&limit=&offset=` | `read:customers`  | Lista clientes (mais recentes primeiro); `q` busca por nome ou dígitos do CPF |
| POST   | `/customers`                   | `write:customers` | Cria cliente (endereço e perfil financeiro opcionais)                         |
| GET    | `/customers/{id}`              | `read:customers`  | Consulta cliente (usado internamente pelo Score)                              |
| PUT    | `/customers/{id}/anamnesis`    | `write:customers` | Grava a anamnese (publica `customer.anamnesis_updated`)                       |
| GET    | `/health`                      | pública           | Health check                                                                  |
| GET    | `/metrics`                     | pública\*         | Métricas Prometheus                                                           |

### Credit Score API (`:8082`)

| Método | Rota                               | Permissão      | Descrição                                                                                       |
| ------ | ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| POST   | `/scores/evaluations`              | `write:scores` | Body `{customer_id, strategy?}`. Chama o Onboarding (token relay), aplica a Strategy e persiste |
| GET    | `/scores/evaluations?customer_id=` | `read:scores`  | Histórico de avaliações do cliente                                                              |
| GET    | `/scores/customers/{id}/latest`    | `read:scores`  | Score vigente (usado pelo Transactions)                                                         |
| GET    | `/scores/strategies`               | `read:scores`  | Strategies disponíveis na Factory (`simple`, `weighted`) e qual é a padrão                      |
| GET    | `/scores/customers/{id}/status`    | `read:scores`  | Se o score está desatualizado (anamnese alterada depois da última avaliação)                    |
| GET    | `/scores/decisions?customer_id=`   | `read:scores`  | Decisões de crédito recebidas pelo evento `credit.decided`, da mais recente para a mais antiga  |
| GET    | `/health`                          | pública        | Health check                                                                                    |
| GET    | `/metrics`                         | pública\*      | Métricas Prometheus                                                                             |

- `GET /scores/customers/{id}/status` devolve
  `{customer_id, desatualizado, motivo, dividas_ativas, comprometimento_renda}`; `desatualizado` vira `true` ao
  receber `customer.anamnesis_updated` e volta a `false` na próxima avaliação.
- `GET /scores/decisions` devolve
  `[{id, event_id, credit_request_id, customer_id, status, motivo, valor_solicitado, prazo_meses, score, faixa_risco, taxa_juros, occurred_at, received_at}]`
  (parâmetro opcional `limit`, padrão 50, máximo 200).

### Transactions API (`:8080`)

| Método | Rota                          | Permissão        | Descrição                                                   |
| ------ | ----------------------------- | ---------------- | ----------------------------------------------------------- |
| GET    | `/accounts?customerId=`       | `read:accounts`  | Lista contas (todas ou de um cliente)                       |
| POST   | `/accounts`                   | `write:accounts` | Cria conta                                                  |
| GET    | `/accounts/{id}`              | `read:accounts`  | Consulta conta                                              |
| GET    | `/accounts/{id}/transactions` | `read:accounts`  | Extrato, com o saldo após cada lançamento                   |
| POST   | `/transactions`               | `write:accounts` | Body `{accountId, tipo: CREDIT\|DEBIT, valor}`              |
| GET    | `/credits?customerId=`        | `read:credits`   | Lista pedidos de crédito com dados do contrato              |
| POST   | `/credits`                    | `write:credits`  | Consulta o Score (token relay) e decide o pedido de crédito |
| GET    | `/credits/{id}`               | `read:credits`   | Consulta pedido de crédito                                  |
| GET    | `/health`                     | pública          | Health check                                                |
| GET    | `/actuator/health`            | pública\*        | Health do Spring Actuator                                   |
| GET    | `/actuator/prometheus`        | pública\*        | Métricas Prometheus (Micrometer)                            |

`POST /transactions` publica `transaction.created` e `POST /credits` publica `credit.decided` (ver
[Eventos](#eventos-rabbitmq)).

\* Sem token, mas **não** exposta pelo gateway (404): só o Prometheus acessa, pela rede interna do compose.
Rodando o serviço sozinho em dev, responde direto na porta do serviço.

> Atenção às convenções de nomes: as APIs Python usam `snake_case` e a API Java usa `camelCase` nos bodies JSON.
> As APIs Python devolvem datas em UTC sem fuso (`2026-10-21T15:00:00`); a API Java devolve com `Z`.

## Eventos (RabbitMQ)

Exchange `erp.events` (topic). Todo evento tem `event_id`, `event_type` e `occurred_at`, em `snake_case`.

| Routing key                  | Produtor     | Consumidor                                                                                                    | Campos extras                                                                                                   |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `credit.decided`             | Transactions | Score (fila `credit-score.credit-decided`)                                                                    | `credit_request_id, customer_id, valor_solicitado, prazo_meses, score, faixa_risco, status, motivo, taxa_juros` |
| `transaction.created`        | Transactions | —                                                                                                             | `transaction_id, account_id, customer_id, tipo, valor, saldo_apos`                                              |
| `customer.created`           | Onboarding   | Transactions (`transactions.customer-created`): abre conta corrente com saldo zero (`AUTO_OPEN_ACCOUNT=true`) | `customer_id, nome, cpf, email`                                                                                 |
| `customer.anamnesis_updated` | Onboarding   | Score (fila `credit-score.anamnesis-updated`)                                                                 | `customer_id, dividas_ativas, comprometimento_renda`                                                            |

## Regras de decisão de crédito

Faixas de risco por score:

| Faixa      | Score             | Decisão                                       |
| ---------- | ----------------- | --------------------------------------------- |
| BAIXO      | ≥ 750             | **APROVADO** automaticamente, taxa 2,99% a.m. |
| MEDIO      | 500–749           | **REVISAO** (análise manual)                  |
| ALTO       | 300–499           | **NEGADO**                                    |
| MUITO_ALTO | < 300             | **NEGADO**                                    |
| —          | cliente sem score | **NEGADO** com motivo específico              |

## Modelos de dados

### Schema `onboarding`

- `customers` (id, nome, cpf UNIQUE, email, telefone, created_at)
- `addresses` (customer_id, rua, numero, cidade, estado, cep)
- `financial_profiles` (customer_id, renda_mensal, patrimonio, ocupacao)
- `anamnesis` (customer_id, dividas_ativas, comprometimento_renda, updated_at)

### Schema `credit_score`

- `score_evaluations` (customer_id, score, faixa_risco, strategy_usada, created_at)
- `score_factors` (evaluation_id, nome, peso, valor)
- `credit_decisions` (evaluation_id, decisao, motivo)
- `credit_decision_events` (event_id UNIQUE, credit_request_id, customer_id, status, motivo, valor_solicitado, prazo_meses, score, faixa_risco, taxa_juros, occurred_at, received_at) — preenchida pelo evento `credit.decided`
- `customer_score_status` (customer_id, desatualizado, dividas_ativas, comprometimento_renda, last_event_id, updated_at) — preenchida pelo evento `customer.anamnesis_updated`

### Schema `transactions`

- `accounts` (customer_id, saldo, status)
- `transactions` (account_id, tipo, valor, timestamp)
- `credit_requests` (customer_id, valor_solicitado, prazo_meses, score_snapshot, status, motivo)
- `contracts` (credit_request_id, taxa_juros, valor_aprovado)
