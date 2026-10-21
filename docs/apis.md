# APIs, regras de negócio e modelos de dados

Todas as rotas, exceto `/health`, exigem `Authorization: Bearer <access token>` e a permissão
indicada (ver [auth0.md](auth0.md)). Sem token: 401; sem a permissão: 403.

## Endpoints

### Onboarding API (`:8081`)

| Método | Rota                           | Permissão         | Descrição                                                                     |
| ------ | ------------------------------ | ----------------- | ----------------------------------------------------------------------------- |
| GET    | `/customers?q=&limit=&offset=` | `read:customers`  | Lista clientes (mais recentes primeiro); `q` busca por nome ou dígitos do CPF |
| POST   | `/customers`                   | `write:customers` | Cria cliente (endereço e perfil financeiro opcionais)                         |
| GET    | `/customers/{id}`              | `read:customers`  | Consulta cliente (usado internamente pelo Score)                              |
| PUT    | `/customers/{id}/anamnesis`    | `write:customers` | Grava a anamnese                                                              |
| GET    | `/health`                      | pública           | Health check                                                                  |

### Credit Score API (`:8082`)

| Método | Rota                               | Permissão      | Descrição                                                                                       |
| ------ | ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| POST   | `/scores/evaluations`              | `write:scores` | Body `{customer_id, strategy?}`. Chama o Onboarding (token relay), aplica a Strategy e persiste |
| GET    | `/scores/evaluations?customer_id=` | `read:scores`  | Histórico de avaliações do cliente                                                              |
| GET    | `/scores/customers/{id}/latest`    | `read:scores`  | Score vigente (usado pelo Transactions)                                                         |
| GET    | `/scores/strategies`               | `read:scores`  | Strategies disponíveis na Factory (`simple`, `weighted`) e qual é a padrão                      |
| GET    | `/health`                          | pública        | Health check                                                                                    |

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

> Atenção às convenções de nomes: as APIs Python usam `snake_case` e a API Java usa `camelCase` nos bodies JSON.
> As APIs Python devolvem datas em UTC sem fuso (`2026-10-21T15:00:00`); a API Java devolve com `Z`.

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
