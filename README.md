# ERP Banking — Frontend

Frontend do projeto **ERP Banking e Crédito** (Projeto de Software, Insper). Veja o contexto completo em [docs/](docs/README.md).

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · Axios · ESLint · Prettier

## Como rodar

```bash
npm install
cp .env.example .env   # ajuste as URLs das APIs se necessário
npm run dev            # http://localhost:5173
```

Os serviços de backend precisam estar no ar (ver [docs/ambiente-dev.md](docs/ambiente-dev.md)).

## Variáveis de ambiente

| Variável                    | Padrão                  | Descrição               |
| --------------------------- | ----------------------- | ----------------------- |
| `VITE_ONBOARDING_API_URL`   | `http://localhost:8001` | Onboarding API          |
| `VITE_SCORE_API_URL`        | `http://localhost:8002` | Credit Score API        |
| `VITE_TRANSACTIONS_API_URL` | `http://localhost:8080` | Transactions API        |
| `VITE_API_TIMEOUT_MS`       | `10000`                 | Timeout das requisições |

As variáveis são lidas apenas em `src/config/env.ts`. Nunca coloque segredos em `VITE_*`: elas vão para o bundle.

## Scripts

| Comando                           | O que faz                     |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento   |
| `npm run build`                   | Typecheck + build de produção |
| `npm run lint` / `lint:fix`       | ESLint                        |
| `npm run format` / `format:check` | Prettier                      |
| `npm run typecheck`               | Apenas checagem de tipos      |

## Estrutura

```
src/
├── components/   # componentes reutilizáveis
├── pages/        # uma página por rota
├── routes/       # roteador
├── services/     # clients HTTP e chamadas às APIs
└── config/       # variáveis de ambiente
```

Alias `@/` aponta para `src/`.
