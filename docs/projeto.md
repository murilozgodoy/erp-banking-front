# ERP Banking e Crédito — Visão geral

Plataforma empresarial em microsserviços para digitalizar operações bancárias.
Trabalho semestral da disciplina **Projeto de Software** (Insper, prof. Eduardo Santana), desenvolvido por um grupo de 6 integrantes.

## Arquitetura

Três serviços de negócio independentes que se comunicam por HTTP/JSON, e um frontend React:

| Serviço          | Stack                     | Porta local | Responsabilidade                                                                              |
| ---------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Onboarding API   | Python 3.13 + FastAPI     | 8081        | Cadastra clientes e coleta dados pessoais, financeiros e a anamnese                           |
| Credit Score API | Python 3.13 + FastAPI     | 8082        | Calcula o score de crédito consultando o Onboarding                                           |
| Transactions API | Java 21 + Spring Boot 3.3 | 8080        | Registra contas, transações e contratos de crédito; consulta o Score antes de aprovar crédito |
| Frontend         | React 19 + Vite           | 5173        | Interface; login no Auth0 e chamadas autenticadas às 3 APIs                                   |

As portas 8080, 8081 e 8082 são as abertas na instância EC2 da AWS.

```
              ┌──► Onboarding API ◄──────────── Credit Score API ◄──── Transactions API
Frontend ─────┼──► Credit Score API                (token relay)          (token relay)
 (Auth0)      └──► Transactions API
```

- **Autenticação/autorização:** Auth0 (OAuth 2.0 + JWT). O front obtém o access token; as APIs
  validam o JWT e checam as permissões (RBAC). Ver [auth0.md](auth0.md).
- **Banco:** um único PostgreSQL com 3 schemas (`onboarding`, `credit_score`, `transactions`), um por serviço. Cada serviço acessa somente o próprio schema; dados de outro serviço vêm sempre pela API dele, nunca por SQL direto.
- **Dev/testes:** SQLite/H2 em memória. **Produção:** PostgreSQL via variável `DATABASE_URL`.
- **Plano final (Etapa 4):** containers Docker numa EC2 AWS (back) e Vercel (front), com API Gateway e Prometheus/Grafana.

### Padrões de projeto

- **Strategy + Factory** (Credit Score): `SimpleRuleStrategy` e `WeightedStrategy` implementam `ScoreStrategy`; `ScoreStrategyFactory.create(name)` seleciona a estratégia (o front lista as opções via `GET /scores/strategies`).
- **Singleton** (Transactions): `RestClientConfig` provê o `RestTemplate` como `@Bean`.
- **Repository:** SQLAlchemy (Python) e Spring Data JPA (Java).

## Repositórios

| Repositório                                                                                  | Cobertura | Status            |
| -------------------------------------------------------------------------------------------- | --------- | ----------------- |
| [erp-banking-onboarding-api](https://github.com/murilozgodoy/erp-banking-onboarding-api)     | ~98%      | Etapa 3 concluída |
| [erp-banking-credit-score-api](https://github.com/murilozgodoy/erp-banking-credit-score-api) | ~99%      | Etapa 3 concluída |
| [erp-banking-transactions-api](https://github.com/murilozgodoy/erp-banking-transactions-api) | ~98%      | Etapa 3 concluída |
| [erp-banking-front](https://github.com/murilozgodoy/erp-banking-front)                       | ~100%     | Etapa 3 concluída |

## Cronograma

| Etapa | Entrega    | Escopo                                                                                          | Status      |
| ----- | ---------- | ----------------------------------------------------------------------------------------------- | ----------- |
| 1     | 09/09/2026 | Documento de arquitetura + repositórios configurados                                            | ✅ Entregue |
| 2     | 28/09/2026 | 3 serviços + testes com cobertura ≥ 80%                                                         | ✅ Entregue |
| 3     | 21/10/2026 | Auth0 (OAuth2/JWT + RBAC) + Frontend                                                            | ✅ Entregue |
| 4     | 04/11/2026 | API Gateway + testes de carga + Prometheus/Grafana + deploy AWS/Vercel + comunicação assíncrona | ⏳          |

## Fora de escopo até a etapa correspondente

- API Router/Gateway, Prometheus/Grafana, deploy (EC2 e Vercel) e comunicação assíncrona → **Etapa 4**.
