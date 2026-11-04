# ERP Banking e Crédito — Visão geral

Plataforma empresarial em microsserviços para digitalizar operações bancárias.
Trabalho semestral da disciplina **Projeto de Software** (Insper, prof. Eduardo Santana), desenvolvido por um grupo de 6 integrantes.

## Arquitetura

Três serviços de negócio independentes que se comunicam por HTTP/JSON e por eventos (RabbitMQ), atrás de um
API Gateway, e um frontend React:

| Serviço          | Stack                     | Porta local | Responsabilidade                                                                              |
| ---------------- | ------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Onboarding API   | Python 3.13 + FastAPI     | 8081        | Cadastra clientes e coleta dados pessoais, financeiros e a anamnese                           |
| Credit Score API | Python 3.13 + FastAPI     | 8082        | Calcula o score de crédito consultando o Onboarding                                           |
| Transactions API | Java 21 + Spring Boot 3.3 | 8080        | Registra contas, transações e contratos de crédito; consulta o Score antes de aprovar crédito |
| Frontend         | React 19 + Vite           | 5173        | Interface; login no Auth0 e chamadas autenticadas às 3 APIs                                   |

As portas da tabela são as de cada serviço rodando sozinho (dev sem gateway). No Docker Compose do
[erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra) as APIs ficam só na rede interna e a EC2
publica **8080 = API Gateway**, **8081 = Grafana** e **8082 = Prometheus** (bloqueada no Security Group: Prometheus pelo Grafana Explore ou túnel
SSH; o RabbitMQ Management também só por túnel SSH).

```
                         ┌──► /onboarding   → Onboarding API ◄──── Credit Score API ◄──── Transactions API
Frontend ──► API Gateway ┼──► /score        → Credit Score API     (token relay)          (token relay)
 (Auth0)     (nginx)     └──► /transactions → Transactions API

Eventos (RabbitMQ, exchange erp.events): Transactions → Score (credit.decided), Onboarding → Score (customer.anamnesis_updated),
                                          Onboarding → Transactions (customer.created) e transaction.created (sem consumidor obrigatório)
Métricas: Prometheus coleta os 3 serviços, o gateway (nginx-exporter) e o RabbitMQ; Grafana mostra os dashboards
```

- **Autenticação/autorização:** Auth0 (OAuth 2.0 + JWT). O front obtém o access token; as APIs
  validam o JWT e checam as permissões (RBAC). Ver [auth0.md](auth0.md).
- **Banco:** um único PostgreSQL com 3 schemas (`onboarding`, `credit_score`, `transactions`), um por serviço. Cada serviço acessa somente o próprio schema; dados de outro serviço vêm sempre pela API dele, nunca por SQL direto.
- **Dev/testes:** SQLite/H2 em memória. **Produção:** PostgreSQL via variável `DATABASE_URL`.
- **Produção (Etapa 4):** back em containers Docker numa EC2 AWS (`3.235.6.136`) e front na Vercel
  (<https://erp-banking-front.vercel.app>), com API Gateway, RabbitMQ e Prometheus/Grafana. Ver
  [etapa-4.md](etapa-4.md).

### Padrões de projeto

- **Strategy + Factory** (Credit Score): `SimpleRuleStrategy` e `WeightedStrategy` implementam `ScoreStrategy`; `ScoreStrategyFactory.create(name)` seleciona a estratégia (o front lista as opções via `GET /scores/strategies`).
- **Singleton** (Transactions): `RestClientConfig` provê o `RestTemplate` como `@Bean`.
- **Repository:** SQLAlchemy (Python) e Spring Data JPA (Java).

## Repositórios

| Repositório                                                                                  | Cobertura | Status  |
| -------------------------------------------------------------------------------------------- | --------- | ------- |
| [erp-banking-onboarding-api](https://github.com/murilozgodoy/erp-banking-onboarding-api)     | ~98%      | Etapa 4 |
| [erp-banking-credit-score-api](https://github.com/murilozgodoy/erp-banking-credit-score-api) | ~99%      | Etapa 4 |
| [erp-banking-transactions-api](https://github.com/murilozgodoy/erp-banking-transactions-api) | ~98%      | Etapa 4 |
| [erp-banking-front](https://github.com/murilozgodoy/erp-banking-front)                       | ~100%     | Etapa 4 |
| [erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra)                       | —         | Etapa 4 |

O 5º repositório, [erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra), é a **infraestrutura**: compose, gateway, observabilidade, carga, deploy e carga de demo.

## Cronograma

| Etapa | Entrega    | Escopo                                                                                          | Status      |
| ----- | ---------- | ----------------------------------------------------------------------------------------------- | ----------- |
| 1     | 09/09/2026 | Documento de arquitetura + repositórios configurados                                            | ✅ Entregue |
| 2     | 28/09/2026 | 3 serviços + testes com cobertura ≥ 80%                                                         | ✅ Entregue |
| 3     | 21/10/2026 | Auth0 (OAuth2/JWT + RBAC) + Frontend                                                            | ✅ Entregue |
| 4     | 04/11/2026 | API Gateway + testes de carga + Prometheus/Grafana + deploy AWS/Vercel + comunicação assíncrona | ✅ Entregue |

O que foi entregue em cada etapa: [etapa-3.md](etapa-3.md) e [etapa-4.md](etapa-4.md).
