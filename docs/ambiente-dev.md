# Ambiente de desenvolvimento

## Rodando os serviços de backend

Cada repositório Python tem seu próprio `.venv/` (não versionado).

```bash
# Onboarding (8001) — repita para o Credit Score trocando a porta para 8002
cd erp-banking-onboarding-api
.venv\Scripts\activate
uvicorn app.main:app --port 8001
pytest          # testes + cobertura
```

```bash
# Transactions (8080)
cd erp-banking-transactions-api
mvn spring-boot:run
mvn verify      # testes + JaCoCo
```

Com os 3 serviços no ar, o `smoke_test.py` valida o fluxo de ponta a ponta.

## CI/CD

Cada repositório de backend tem `.github/workflows/ci.yml`, executado em todo push/PR:

1. **test**: instala dependências, roda os testes e falha se a cobertura ficar abaixo de 80%.
2. **docker-build**: valida que o Dockerfile builda.

Relatórios de cobertura ficam como artifacts por 7 dias (`htmlcov/` no Python, `target/site/jacoco/` no Java).
O deploy automático para a AWS fica para a Etapa 4.

## Compatibilidade conhecida

### Java 25 rodando projeto Java 21

- Mockito forçado para **5.14.2** (o 5.11 trazido pelo Spring Boot 3.3.4 não mocka classes concretas no Java 25).
- JaCoCo forçado para **0.8.13** (o 0.8.12 não suporta bytecode do Java 25).
- Surefire `argLine` com `-XX:+EnableDynamicAgentLoading -Dnet.bytebuddy.experimental=true`.

### Python 3.13

- `psycopg[binary]==3.2.3` em vez de `psycopg2-binary` (que não compila no 3.13).
- `pydantic[email]==2.9.2` com `email-validator`.
