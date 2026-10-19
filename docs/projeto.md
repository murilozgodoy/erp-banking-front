# ERP Banking e Crédito — Visão geral

Plataforma empresarial em microsserviços para digitalizar operações bancárias.
Trabalho semestral da disciplina **Projeto de Software** (Insper, prof. Eduardo Santana), desenvolvido por um grupo de 6 integrantes.

## Arquitetura

Três serviços de negócio independentes que se comunicam por HTTP/JSON:

| Serviço          | Stack                     | Porta local | Responsabilidade                                                                              |
| ---------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Onboarding API   | Python 3.13 + FastAPI     | 8001        | Cadastra clientes e coleta dados pessoais, financeiros e a anamnese                           |
| Credit Score API | Python 3.13 + FastAPI     | 8002        | Calcula o score de crédito consultando o Onboarding                                           |
| Transactions API | Java 21 + Spring Boot 3.3 | 8080        | Registra contas, transações e contratos de crédito; consulta o Score antes de aprovar crédito |

```
Frontend ──► Onboarding API ◄── Credit Score API ◄── Transactions API
        ├──► Credit Score API
        └──► Transactions API
```

- **Banco:** um único PostgreSQL com 3 schemas (`onboarding`, `credit_score`, `transactions`), um por serviço. Cada serviço acessa somente o próprio schema; dados de outro serviço vêm sempre pela API dele, nunca por SQL direto.
- **Dev/testes:** SQLite em memória. **Produção:** PostgreSQL via variável `DATABASE_URL`.
- **Plano final (Etapa 4):** containers Docker numa EC2 AWS, com Auth0, API Gateway e Prometheus/Grafana.

### Padrões de projeto

- **Strategy + Factory** (Credit Score): `SimpleRuleStrategy` e `WeightedStrategy` implementam `ScoreStrategy`; `ScoreStrategyFactory.create(name)` seleciona a estratégia.
- **Singleton** (Transactions): `RestClientConfig` provê o `RestTemplate` como `@Bean`.
- **Repository:** SQLAlchemy (Python) e Spring Data JPA (Java).

## Repositórios

| Repositório                                                                                  | Cobertura | Status                       |
| -------------------------------------------------------------------------------------------- | --------- | ---------------------------- |
| [erp-banking-onboarding-api](https://github.com/murilozgodoy/erp-banking-onboarding-api)     | 95,85%    | Pronto                       |
| [erp-banking-credit-score-api](https://github.com/murilozgodoy/erp-banking-credit-score-api) | 97,51%    | Pronto                       |
| [erp-banking-transactions-api](https://github.com/murilozgodoy/erp-banking-transactions-api) | 97%       | Pronto                       |
| [erp-banking-front](https://github.com/murilozgodoy/erp-banking-front)                       | —         | Em desenvolvimento (Etapa 3) |

## Cronograma

| Etapa | Entrega    | Escopo                                                                                   | Status          |
| ----- | ---------- | ---------------------------------------------------------------------------------------- | --------------- |
| 1     | 09/09/2026 | Documento de arquitetura + repositórios configurados                                     | ✅ Entregue     |
| 2     | 28/09/2026 | 3 serviços + testes com cobertura ≥ 80%                                                  | ✅ Entregue     |
| 3     | 21/10/2026 | Auth0 (OAuth2/JWT) + Frontend                                                            | ⏳ Em andamento |
| 4     | 04/11/2026 | API Gateway + testes de carga + Prometheus/Grafana + deploy AWS + comunicação assíncrona | ⏳              |

## Fora de escopo até a etapa correspondente

- API Router/Gateway, Prometheus/Grafana, deploy na EC2 e comunicação assíncrona → **Etapa 4**.
