# ERP Banking — Frontend

Frontend do projeto **ERP Banking e Crédito** (Projeto de Software, Insper). Veja o contexto completo em [docs/](docs/README.md).

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · TanStack Query · Axios · Auth0 · Vitest · ESLint · Prettier

## Como rodar

```bash
npm install
cp .env.example .env   # ajuste as URLs das APIs e os dados do Auth0
npm run dev            # http://localhost:5173
```

Os serviços de backend precisam estar no ar (ver [docs/ambiente-dev.md](docs/ambiente-dev.md)) e o
Auth0 configurado (ver [docs/auth0.md](docs/auth0.md)).

## Variáveis de ambiente

| Variável                    | Padrão                    | Descrição                                      |
| --------------------------- | ------------------------- | ---------------------------------------------- |
| `VITE_ONBOARDING_API_URL`   | `http://localhost:8081`   | Onboarding API                                 |
| `VITE_SCORE_API_URL`        | `http://localhost:8082`   | Credit Score API                               |
| `VITE_TRANSACTIONS_API_URL` | `http://localhost:8080`   | Transactions API                               |
| `VITE_API_TIMEOUT_MS`       | `10000`                   | Timeout das requisições                        |
| `VITE_AUTH0_DOMAIN`         | —                         | Domínio do tenant Auth0                        |
| `VITE_AUTH0_CLIENT_ID`      | —                         | Client ID da Application SPA                   |
| `VITE_AUTH0_AUDIENCE`       | `https://erp-banking-api` | Identifier da API no Auth0 (igual ao das APIs) |

As variáveis são lidas apenas em `src/config/env.ts`, que falha cedo se faltar alguma. Nunca
coloque segredos em `VITE_*`: elas vão para o bundle.

## Scripts

| Comando                           | O que faz                         |
| --------------------------------- | --------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento       |
| `npm run build`                   | Typecheck + build de produção     |
| `npm test` / `test:watch`         | Testes (Vitest + Testing Library) |
| `npm run test:coverage`           | Testes com cobertura (mínimo 80%) |
| `npm run lint` / `lint:fix`       | ESLint                            |
| `npm run format` / `format:check` | Prettier                          |
| `npm run typecheck`               | Apenas checagem de tipos          |

## Estrutura

```
src/
├── auth/         # permissões do ERP e leitura do access token
├── components/   # componentes reutilizáveis (auth/, layout/, ui/ e um diretório por domínio)
├── config/       # variáveis de ambiente
├── hooks/        # useApi (services autenticados) e usePermissions
├── lib/          # formatação pt-BR, mensagens de erro e React Query
├── pages/        # uma página por rota
├── routes/       # roteador (rotas protegidas por RequireAuth)
├── services/     # clients HTTP (com o token do Auth0) e chamadas às APIs
├── test/         # helpers e fixtures dos testes
└── types/        # contratos das APIs
```

Alias `@/` aponta para `src/`.

## Autenticação e autorização

Login pelo Auth0 (Authorization Code + PKCE). O access token vai em `Authorization: Bearer` em
toda chamada às APIs, que validam o JWT e exigem uma permissão por rota (RBAC). O front lê as
permissões do token apenas para esconder telas e ações que o usuário não pode usar. Detalhes em
[docs/auth0.md](docs/auth0.md).
