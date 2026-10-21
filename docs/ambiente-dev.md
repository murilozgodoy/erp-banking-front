# Ambiente de desenvolvimento

## Rodando os serviços de backend

Cada serviço lê as variáveis do próprio `.env` (fora do git; copie o `.env.example`). Todos
precisam de `AUTH0_DOMAIN` e `AUTH0_AUDIENCE=https://erp-banking-api`.

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
O deploy automático (AWS e Vercel) fica para a Etapa 4.

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
