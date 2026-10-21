# Etapa 3 — Auth0 + Frontend (entrega 21/10/2026)

## Escopo

- **Autenticação e autorização** com Auth0 (OAuth 2.0 + JWT) nos 3 serviços.
- **Frontend** neste repositório, consumindo os 3 serviços.

## O que foi entregue

### Segurança (detalhes em [auth0.md](auth0.md))

- Login no front pelo Auth0 Universal Login (Authorization Code + PKCE), com cadastro de conta.
- Access token JWT com audience `https://erp-banking-api`, enviado em `Authorization: Bearer`.
- Os 3 serviços validam assinatura (JWKS/RS256), issuer, audience, expiração e `sub` (401).
- **Autorização por RBAC**: 8 permissões e 3 perfis (`admin`, `analista`, `atendente`) no Auth0;
  cada rota exige uma permissão (403).
- **Token relay** nas chamadas Score → Onboarding e Transactions → Score.
- CORS restrito à origem do front; configuração do Auth0 só por variáveis de ambiente (`.env`
  fora do git).

### Frontend

| Rota             | Tela                                                                                            | Permissão         |
| ---------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| `/login`         | Entrar / criar conta                                                                            | pública           |
| `/`              | Painel: atalhos por perfil e status dos microsserviços                                          | logado            |
| `/clientes`      | Listagem com busca por nome ou CPF                                                              | `read:customers`  |
| `/clientes/novo` | Cadastro com endereço e perfil financeiro                                                       | `write:customers` |
| `/clientes/:id`  | Ficha 360°: dados, anamnese, score (cálculo com strategy, fatores, histórico), contas e crédito | `read:customers`  |
| `/contas`        | Contas com filtro por cliente e abertura de conta                                               | `read:accounts`   |
| `/contas/:id`    | Saldo, extrato com saldo após cada lançamento e registro de crédito/débito                      | `read:accounts`   |
| `/creditos`      | Solicitação de crédito com o resultado na hora e listagem dos pedidos                           | `read:credits`    |
| `/perfil`        | Dados da conta, permissões concedidas e cópia do access token (só em dev)                       | logado            |

Ações de escrita (botões e formulários) só aparecem com a permissão `write:*` correspondente.

### Backend (novos endpoints para o front)

`GET /customers` (busca), `GET /scores/evaluations?customer_id=` (histórico),
`GET /scores/strategies`, `GET /accounts?customerId=`, `GET /accounts/{id}/transactions` (extrato)
e `GET /credits?customerId=`. Ver [apis.md](apis.md).

### Qualidade

- Front: Vitest + Testing Library com cobertura mínima de 80% (atual ~100% das linhas), ESLint,
  Prettier e typecheck no CI (GitHub Actions), além do build de produção.
- Backends: testes de 401/403/token relay; cobertura segue acima de 95% nos três.

## Decisões tomadas

| Tema                    | Decisão                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Framework               | React 19 + Vite, TypeScript                                                                |
| Estilo                  | Tailwind CSS v4 (`@tailwindcss/vite`)                                                      |
| Roteamento / dados      | React Router 7 + Axios + TanStack Query                                                    |
| Qualidade               | ESLint (flat config) + Prettier + Vitest/Testing Library                                   |
| Fluxo de login          | Auth0 Universal Login (Authorization Code + PKCE), cache em `localStorage` + refresh token |
| Autorização             | RBAC do Auth0 (claim `permissions`), checada nas APIs; o front só adapta a interface       |
| Chamadas entre serviços | Token relay (repasse do token do usuário), em vez de Machine-to-Machine                    |
| Exposição dos serviços  | Front chama os 3 serviços diretamente; o API Gateway fica para a Etapa 4                   |
| Portas                  | Onboarding 8081, Credit Score 8082, Transactions 8080 (as abertas na EC2)                  |

## Como demonstrar

1. Subir os 3 serviços e o front ([ambiente-dev.md](ambiente-dev.md)).
2. Entrar com um usuário `admin`: cadastrar cliente → registrar anamnese → calcular score →
   abrir conta → registrar transações → solicitar crédito (aprovado se o risco for baixo).
3. Entrar com um usuário `atendente`: o botão "Calcular score" e a solicitação de crédito não
   aparecem; chamando a API direto, a resposta é 403.
4. `/perfil` mostra as permissões que vieram no token.

## Fora do escopo desta etapa

API Gateway, testes de carga, Prometheus/Grafana, deploy (AWS e Vercel) e comunicação
assíncrona ficam para a Etapa 4.
