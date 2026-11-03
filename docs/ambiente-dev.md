# Ambiente de desenvolvimento

Há dois jeitos de rodar o back localmente:

| Modo                     | Como                                                 | URL das APIs no front                     |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------- |
| **Com gateway** (padrão) | `docker compose up -d` no `erp-banking-infra`        | `http://localhost:8080/<svc>`             |
| **Sem gateway**          | cada API rodando sozinha (Python/Maven) na sua porta | `http://localhost:8081`, `:8082`, `:8080` |

## Rodando o back pelo Docker Compose (com gateway)

O [erp-banking-infra](https://github.com/GabrielRosa1/erp-banking-infra) sobe a stack completa, igual à da EC2:
gateway, as 3 APIs, PostgreSQL, RabbitMQ, Prometheus e Grafana. Os repositórios precisam estar lado a lado
(o compose builda `../erp-banking-onboarding-api` etc.) ou as imagens do GHCR são puxadas.

```bash
cd erp-banking-infra
cp .env.example .env    # Auth0, CORS (inclua http://localhost:5173) e senhas
docker compose up -d    # ou: docker compose pull && docker compose up -d
docker compose ps       # todos healthy
./scripts/smoke.sh      # health de gateway e serviços (ACCESS_TOKEN=... para o fluxo completo)
```

| URL local                                              | O quê                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `http://localhost:8080`                                | API Gateway (`/onboarding`, `/score`, `/transactions`, `/gateway/health`) |
| `http://localhost:8081`                                | Grafana (usuário `admin`, senha `GRAFANA_ADMIN_PASSWORD`)                 |
| `http://localhost:8082`                                | Prometheus                                                                |
| `http://localhost:8080/onboarding/docs`, `/score/docs` | Swagger das APIs Python pelo gateway                                      |

Postgres e RabbitMQ não são publicados; para acessá-los use o override
`docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d` (publica só em `127.0.0.1`). Pelo
compose a mensageria está ligada (`RABBITMQ_URL` definido), então os eventos fluem entre os serviços.

## Rodando os serviços de backend sem gateway

Cada serviço lê as variáveis do próprio `.env` (fora do git; copie o `.env.example`). Todos
precisam de `AUTH0_DOMAIN` e `AUTH0_AUDIENCE=https://erp-banking-api`. Sem `RABBITMQ_URL` a mensageria fica
desligada (no-op): as APIs funcionam, mas os eventos não são publicados nem consumidos (o card de decisões via
evento e o aviso de score desatualizado ficam vazios).

```bash
# Onboarding (8081)
cd erp-banking-onboarding-api
.venv\Scripts\activate
python -m app.main
pytest          # testes + cobertura

# Credit Score (8082)
cd erp-banking-credit-score-api
.venv\Scripts\activate
python -m app.main
pytest
```

```bash
# Transactions (8080) — o .env da raiz do projeto é lido automaticamente
cd erp-banking-transactions-api
mvn spring-boot:run
mvn verify      # testes + JaCoCo
```

## Rodando o front

```bash
cd erp-banking-front
npm install
cp .env.example .env   # preencha VITE_AUTH0_CLIENT_ID e o domínio
npm run dev            # http://localhost:5173
npm test               # testes (npm run test:coverage para a cobertura)
```

O login só funciona depois da configuração do Auth0 descrita em [auth0.md](auth0.md).

O `.env.example` traz os três modos de URL das APIs; deixe ativo só o que corresponde ao back que está rodando:

| Modo                               | `VITE_ONBOARDING_API_URL`          | `VITE_SCORE_API_URL`          | `VITE_TRANSACTIONS_API_URL`          |
| ---------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------ |
| 1. Local com gateway (padrão)      | `http://localhost:8080/onboarding` | `http://localhost:8080/score` | `http://localhost:8080/transactions` |
| 2. Local sem gateway               | `http://localhost:8081`            | `http://localhost:8082`       | `http://localhost:8080`              |
| 3. Produção (Vercel, via rewrites) | `/api/onboarding`                  | `/api/score`                  | `/api/transactions`                  |

Variáveis opcionais (vazias = o item não aparece na página **Monitoramento**):

- `VITE_GATEWAY_URL` — base do gateway, usada para o `/gateway/health` (`http://localhost:8080` local, `/api` na
  Vercel). No modo sem gateway, deixe vazia.
- `VITE_GRAFANA_URL` / `VITE_PROMETHEUS_URL` — links do monitoramento (`http://localhost:8081` / `:8082` local).

> Em dev, os 429/503 gerados pelo próprio gateway não trazem cabeçalhos CORS e o navegador os reporta como erro
> de rede; o front mostra uma mensagem que cobre os dois casos. Na Vercel isso não acontece (mesma origem).

## Testes de carga

Ficam no `erp-banking-infra/load-tests/` (k6 via Docker, contra o gateway). Ver
[etapa-4.md](etapa-4.md#testes-de-carga-k6).

## Smoke test de ponta a ponta

Com os 3 serviços no ar, o `smoke_test.py` (pasta raiz do projeto) percorre cliente → anamnese →
score → conta → transação → extrato → crédito. Ele precisa de um access token de um usuário
`admin`: no front em modo dev, abra **Meu perfil → Copiar access token** e rode:

```powershell
$env:ACCESS_TOKEN = "<token>"; python smoke_test.py
```

## CI/CD

Cada repositório tem `.github/workflows/ci.yml`, executado em todo push/PR na `main`:

- **APIs:** testes com cobertura mínima de 80% e build da imagem Docker.
- **Front:** ESLint, Prettier, typecheck, testes Vitest com cobertura mínima de 80% e build de produção.

Relatórios de cobertura ficam como artifacts por 7 dias (`htmlcov/` no Python, `target/site/jacoco/` no Java, `coverage/` no front).

Deploy (detalhes em [etapa-4.md](etapa-4.md#deploy)):

- **APIs:** o job `publish` do CI publica as imagens em `ghcr.io/murilozgodoy/<repo>` a cada push na `main`; a
  EC2 é atualizada pelo `scripts/deploy-ec2.sh` (ou workflow `deploy.yml`) do `erp-banking-infra`.
- **Front:** `vercel deploy --prod --yes` (projeto `gabrielrosa1s-projects/erp-banking-front`), publicado em
  <https://erp-banking-front.vercel.app>.

## Compatibilidade conhecida

### Java 25 rodando projeto Java 21

- Mockito forçado para **5.14.2** (o 5.11 trazido pelo Spring Boot 3.3.4 não mocka classes concretas no Java 25).
- JaCoCo forçado para **0.8.13** (o 0.8.12 não suporta bytecode do Java 25).
- Surefire `argLine` com `-XX:+EnableDynamicAgentLoading -Dnet.bytebuddy.experimental=true`.

### Python 3.13

- `psycopg[binary]==3.2.3` em vez de `psycopg2-binary` (que não compila no 3.13). Na `DATABASE_URL`, use `postgresql+psycopg://`.
- `pydantic[email]==2.9.2` com `email-validator`.

### Windows

- Com `core.autocrlf=true` os arquivos ficam com CRLF no checkout; o Prettier do front usa `endOfLine: auto` para não acusar diferença.
