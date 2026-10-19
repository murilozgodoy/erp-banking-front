# Auth0 — o que o back precisa fazer

O front faz o login (Authorization Code + PKCE) e envia o **access token JWT** em `Authorization: Bearer <token>`. Os 3 serviços passam a **validar** esse token. Nenhum serviço implementa o fluxo OAuth.

## Dados do tenant

| Item             | Valor                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Domain           | `dev-slbrfj6dwk1pdeox.us.auth0.com`                               |
| Issuer (`iss`)   | `https://dev-slbrfj6dwk1pdeox.us.auth0.com/` (com a barra final)  |
| JWKS             | `https://dev-slbrfj6dwk1pdeox.us.auth0.com/.well-known/jwks.json` |
| Algoritmo        | RS256                                                             |
| Audience (`aud`) | identificador da API no Auth0 (**pendente**, ver abaixo)          |

## Pré-requisito no painel do Auth0 (uma vez, feito por quem administra o tenant)

1. **Applications → APIs → Create API** com um Identifier, por exemplo `https://erp-banking-api`. Esse valor é o **audience**.
2. Preencher `VITE_AUTH0_AUDIENCE` no `.env` do front com o mesmo valor.
3. Sem o audience, o Auth0 devolve um token opaco, que as APIs não conseguem validar.

## Tarefas por serviço

Para cada API (Onboarding, Credit Score e Transactions):

1. **Validar o JWT em todas as rotas, exceto `/health`**: assinatura via JWKS, `iss`, `aud` e `exp`.
2. Responder **401** sem token ou com token inválido, e **403** quando faltar permissão.
3. **Liberar CORS** para `http://localhost:5173` (e depois para o domínio de produção), com o header `Authorization` e os métodos usados. Sem isso o navegador bloqueia as chamadas.
4. Receber a configuração por variável de ambiente, nunca fixa no código: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`.
5. **Testes**: manter a cobertura ≥ 80%. Os testes não chamam o Auth0; usam token/usuário simulado.

### Python (FastAPI)

- Dependência de segurança (`Depends`) que baixa o JWKS e valida o token com `PyJWT` (`PyJWKClient`) ou `authlib`. Aplicar em todos os routers, deixando `/health` público.
- Nos testes, usar `app.dependency_overrides` para trocar a dependência.

### Java (Spring Boot)

- `spring-boot-starter-oauth2-resource-server`, com `spring.security.oauth2.resourceserver.jwt.issuer-uri` apontando para o issuer.
- Adicionar um validador de audience (o Spring só valida o issuer por padrão).
- `SecurityFilterChain`: `/health` liberado, `anyRequest().authenticated()`, CORS configurado.
- Nos testes, `spring-security-test` com `jwt()`. Atenção às versões já fixadas por causa do Java 25 (ver `ambiente-dev.md`).

## Decisão pendente: chamadas entre serviços

Score → Onboarding e Transactions → Score hoje não enviam token. Duas opções:

- **Repassar o token do usuário** (mais simples; o serviço chamado valida o mesmo JWT).
- **Machine-to-Machine (client credentials)**: cada serviço tem credenciais próprias e pede o próprio token ao Auth0 (mais correto, mais trabalho).

Definir antes de implementar, porque muda os clients HTTP e os mocks de teste (`respx` e `MockRestServiceServer`).

## Fora do escopo desta etapa

Roles e permissions por rota podem ficar para depois; basta validar o token. API Gateway é Etapa 4.
