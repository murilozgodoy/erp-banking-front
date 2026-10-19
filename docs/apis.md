# APIs, regras de negócio e modelos de dados

## Endpoints

### Onboarding API (`:8001`)

| Método | Rota                        | Descrição                                        |
| ------ | --------------------------- | ------------------------------------------------ |
| POST   | `/customers`                | Cria cliente                                     |
| GET    | `/customers/{id}`           | Consulta cliente (usado internamente pelo Score) |
| PUT    | `/customers/{id}/anamnesis` | Grava a anamnese                                 |
| GET    | `/health`                   | Health check                                     |

### Credit Score API (`:8002`)

| Método | Rota                            | Descrição                                                                         |
| ------ | ------------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/scores/evaluations`           | Body `{customer_id, strategy?}`. Chama o Onboarding, aplica a Strategy e persiste |
| GET    | `/scores/customers/{id}/latest` | Score vigente (usado pelo Transactions)                                           |
| GET    | `/health`                       | Health check                                                                      |

### Transactions API (`:8080`)

| Método | Rota             | Descrição                                      |
| ------ | ---------------- | ---------------------------------------------- |
| POST   | `/accounts`      | Cria conta                                     |
| GET    | `/accounts/{id}` | Consulta conta                                 |
| POST   | `/transactions`  | Body `{accountId, tipo: CREDIT\|DEBIT, valor}` |
| POST   | `/credits`       | Consulta o Score e decide o pedido de crédito  |
| GET    | `/credits/{id}`  | Consulta pedido de crédito                     |
| GET    | `/health`        | Health check                                   |

> Atenção às convenções de nomes: as APIs Python usam `snake_case` e a API Java usa `camelCase` nos bodies JSON.

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

### Schema `transactions`

- `accounts` (customer_id, saldo, status)
- `transactions` (account_id, tipo, valor, timestamp)
- `credit_requests` (customer_id, valor_solicitado, prazo_meses, score_snapshot, status, motivo)
- `contracts` (credit_request_id, taxa_juros, valor_aprovado)
