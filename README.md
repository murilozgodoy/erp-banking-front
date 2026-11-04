# ERP Banking — Frontend

Frontend do projeto **ERP Banking e Crédito** (Projeto de Software, Insper). Veja o contexto completo em [docs/](docs/README.md).

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · TanStack Query · Axios · Auth0 · Vitest · ESLint · Prettier

**Infra e deploy:** [erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra) (compose, gateway, observabilidade, carga, deploy e carga de demo)

## Como rodar

```bash
npm install
cp .env.example .env   # ajuste as URLs das APIs e os dados do Auth0
npm run dev            # http://localhost:5173
```

Os serviços de backend precisam estar no ar — pelo Docker Compose do `erp-banking-infra` (gateway na 8080,
padrão do `.env.example`) ou cada um na sua porta (ver [docs/ambiente-dev.md](docs/ambiente-dev.md)) — e o
Auth0 configurado (ver [docs/auth0.md](docs/auth0.md)).

## Produção

Front na Vercel: <https://erp-banking-front.vercel.app>, falando com o API Gateway na AWS EC2 (`3.235.6.136`,
compose do [erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra)). Na EC2 só ficam públicos o
gateway (**8080**) e o Grafana (**8081**); o Prometheus (**8082**) é acessado pelo Grafana (Explore) ou túnel SSH,
pois a 8082 está bloqueada no Security Group; as APIs ficam na rede interna. Arquitetura,
deploy e checklist da Etapa 4 em [docs/etapa-4.md](docs/etapa-4.md).

## Variáveis de ambiente

| Variável                    | Local (`.env.example`)               | Produção (Vercel)         | Descrição                                      |
| --------------------------- | ------------------------------------ | ------------------------- | ---------------------------------------------- |
| `VITE_ONBOARDING_API_URL`   | `http://localhost:8080/onboarding`   | `/api/onboarding`         | Onboarding API                                 |
| `VITE_SCORE_API_URL`        | `http://localhost:8080/score`        | `/api/score`              | Credit Score API                               |
| `VITE_TRANSACTIONS_API_URL` | `http://localhost:8080/transactions` | `/api/transactions`       | Transactions API                               |
| `VITE_GATEWAY_URL`          | `http://localhost:8080`              | `/api`                    | Opcional: base do gateway (`/gateway/health`)  |
| `VITE_GRAFANA_URL`          | `http://localhost:8081`              | `http://3.235.6.136:8081` | Opcional: link do Grafana                      |
| `VITE_PROMETHEUS_URL`       | `http://localhost:8082`              | vazio (link escondido)    | Opcional: link do Prometheus                   |
| `VITE_API_TIMEOUT_MS`       | `10000`                              | `15000`                   | Timeout das requisições                        |
| `VITE_AUTH0_DOMAIN`         | —                                    | —                         | Domínio do tenant Auth0                        |
| `VITE_AUTH0_CLIENT_ID`      | —                                    | —                         | Client ID da Application SPA                   |
| `VITE_AUTH0_AUDIENCE`       | `https://erp-banking-api`            | `https://erp-banking-api` | Identifier da API no Auth0 (igual ao das APIs) |

Sem gateway (cada API na sua porta), use `http://localhost:8081`, `:8082` e `:8080` e deixe `VITE_GATEWAY_URL`
vazia; o `.env.example` traz os três modos. As opcionais vazias escondem o item correspondente na página
**Monitoramento** (só `admin`: health dos 3 serviços e do gateway, links para Grafana, Prometheus e Swagger).

As variáveis são lidas apenas em `src/config/env.ts`, que falha cedo se faltar alguma. Nunca
coloque segredos em `VITE_*`: elas vão para o bundle.

## Docker (alternativa à Vercel)

Imagem multi-stage: build com `node:22-alpine` e SPA servida por `nginx-unprivileged` (não-root,
porta 8080) com fallback de rotas, cache longo em `/assets/`, gzip, headers de segurança e
`/healthz`. As `VITE_*` são embutidas no build; os padrões apontam para o gateway local
(`http://localhost:8080`) e podem ser trocados com `--build-arg`:

```bash
docker build -t erp-banking-front .
# ex.: docker build --build-arg VITE_ONBOARDING_API_URL=https://api.exemplo.com/onboarding ...
docker run --rm -p 3000:8080 erp-banking-front   # http://localhost:3000
```

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

## Testes E2E (Playwright)

Suíte em `e2e/`, contra o front publicado (padrão `https://erp-banking-front.vercel.app`), sem servidor local.
Cobre a `/login`, o redirecionamento das rotas protegidas, os headers de segurança, os `/api/*/health` via
rewrite da Vercel, o 401 sem token e o Swagger do Transactions aberto pela Vercel.

```bash
npx playwright install --only-shell chromium   # uma vez
npm run test:e2e                               # BASE_URL=http://localhost:5173 npm run test:e2e para outro alvo
E2E_ACCESS_TOKEN=eyJ... npm run test:e2e       # inclui os testes autenticados (token copiado de /perfil)
```

Não faz parte do CI obrigatório: rode pelo workflow manual **E2E** (Actions → E2E → Run workflow). O secret
opcional `E2E_ACCESS_TOKEN` habilita os testes autenticados.

### Portal do cliente em modo mock

Suíte em `e2e/portal/` (`playwright.portal.config.ts`): sobe o Vite na porta 5190 com MSW e login simulado
(`VITE_USE_MOCKS=true`, `VITE_MOCK_AUTH=true`, passados pelo `webServer.env`, sem `.env`) e navega como cliente
com `?perfil=cliente&mock=<status>`. Cobre o wizard de onboarding, status →
aprovação, simulação e contratação de capital de giro, pagamento PIX com comprovante, antecipação de recebíveis
e um teste de fumaça de todas as abas (sem erro de console, tema claro e escuro, sem rolagem horizontal em 360 px).

`e2e/portal/jornada.spec.ts` é a jornada completa em série, numa aba só (o estado do MSW vive na página): cadastro
do zero → visão geral → antecipação → boleto → operador acima do limite (`?membro=operador`) → aprovação pelo
financeiro → proposta de crédito aguardando contratação → contratação pelo dono → movimentação de estoque →
equipe (convite, edição, hierarquia como admin) → assistente (Ctrl+K e histórico) → perfil. A troca de membro
muda a URL sem recarregar e adianta o relógio (`Date`) para o `/me` ser buscado de novo. Cada passo salva um
print `NN-passo.png` em `test-results/`.

```bash
npm run test:e2e:portal
npx playwright test -c playwright.portal.config.ts jornada   # só a jornada (~1,5 min)
```

Workflow manual **E2E portal** (Actions → E2E portal → Run workflow): os prints e o relatório HTML sobem sempre
no artefato `portal-e2e-screenshots`.

## Deploy (Vercel)

Projeto `gabrielrosa1s-projects/erp-banking-front`. O `vercel.json` reescreve `/api/onboarding`, `/api/score`,
`/api/transactions` e `/api/gateway` para o gateway na EC2 (`http://3.235.6.136:8080/<svc>`), o que evita _mixed
content_ e CORS, e define o fallback SPA e os headers de segurança.

```bash
vercel link                  # uma vez
vercel deploy --prod --yes
```

As variáveis `VITE_*` de produção ficam no projeto da Vercel e entram no bundle no build: se mudar alguma, faça
novo deploy. A URL da Vercel precisa estar em Allowed Callback URLs, Allowed Logout URLs e Allowed Web Origins da
SPA no Auth0. Passo a passo em [docs/etapa-4.md](docs/etapa-4.md#deploy).

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
