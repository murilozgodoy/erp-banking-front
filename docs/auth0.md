# Auth0 — autenticação e autorização

O front faz o login no Auth0 (OAuth 2.0, Authorization Code + PKCE) e recebe um **access token
JWT** para a API "ERP Banking API". Cada requisição às APIs leva esse token em
`Authorization: Bearer <token>`. As APIs **validam** o token e **autorizam** cada rota pelas
permissões do usuário (RBAC). Nenhum serviço implementa login próprio.

```
Usuário ──login──► Auth0 (Universal Login) ──access token (aud = https://erp-banking-api)──► Front
Front ──Bearer──► Onboarding · Credit Score · Transactions   (validam o JWT e checam a permissão)
Credit Score ──mesmo Bearer──► Onboarding        Transactions ──mesmo Bearer──► Credit Score
```

## Dados do tenant

| Item             | Valor                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Domain           | `dev-slbrfj6dwk1pdeox.us.auth0.com`                               |
| Issuer (`iss`)   | `https://dev-slbrfj6dwk1pdeox.us.auth0.com/` (com a barra final)  |
| JWKS             | `https://dev-slbrfj6dwk1pdeox.us.auth0.com/.well-known/jwks.json` |
| Algoritmo        | RS256                                                             |
| Audience (`aud`) | `https://erp-banking-api` (Identifier da API "ERP Banking API")   |
| Application SPA  | Client ID `OHeEe32c8zz3iLmp1pnrdfe3wCUElgab`                      |

Domain, Client ID e Audience **não são segredos** (vão no bundle do front). Nenhuma API precisa de
client secret para validar tokens.

## Permissões e perfis

| Permissão         | O que libera                                    |
| ----------------- | ----------------------------------------------- |
| `read:customers`  | Listar e consultar clientes                     |
| `write:customers` | Cadastrar clientes e registrar a anamnese       |
| `read:scores`     | Consultar score vigente, histórico e strategies |
| `write:scores`    | Calcular score                                  |
| `read:accounts`   | Listar e consultar contas e extratos            |
| `write:accounts`  | Abrir contas e registrar transações             |
| `read:credits`    | Listar e consultar pedidos de crédito           |
| `write:credits`   | Solicitar crédito                               |

| Perfil      | Permissões                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `admin`     | todas                                                                                                 |
| `analista`  | `read:customers`, `read:scores`, `write:scores`, `read:accounts`, `read:credits`, `write:credits`     |
| `atendente` | `read:customers`, `write:customers`, `read:accounts`, `write:accounts`, `read:scores`, `read:credits` |

Usuário sem perfil consegue entrar, mas toda rota de negócio responde **403**; o front mostra um
aviso pedindo que um administrador atribua um perfil.

### Rotas × permissões

| Serviço      | Rota                                                                                     | Permissão         |
| ------------ | ---------------------------------------------------------------------------------------- | ----------------- |
| Onboarding   | `GET /customers`, `GET /customers/{id}`                                                  | `read:customers`  |
| Onboarding   | `POST /customers`, `PUT /customers/{id}/anamnesis`                                       | `write:customers` |
| Credit Score | `GET /scores/evaluations`, `GET /scores/customers/{id}/latest`, `GET /scores/strategies` | `read:scores`     |
| Credit Score | `POST /scores/evaluations`                                                               | `write:scores`    |
| Transactions | `GET /accounts`, `GET /accounts/{id}`, `GET /accounts/{id}/transactions`                 | `read:accounts`   |
| Transactions | `POST /accounts`, `POST /transactions`                                                   | `write:accounts`  |
| Transactions | `GET /credits`, `GET /credits/{id}`                                                      | `read:credits`    |
| Transactions | `POST /credits`                                                                          | `write:credits`   |

`/health` é público nos três serviços.

## Chamadas entre serviços: token relay

O Credit Score chama o Onboarding e a Transactions chama o Credit Score **repassando o token do
usuário**. O serviço chamado valida o mesmo JWT e aplica as próprias permissões, então:

- calcular score exige `write:scores` **e** `read:customers`;
- solicitar crédito exige `write:credits` **e** `read:scores`.

Se faltar a permissão no serviço chamado, a resposta é **403** com o motivo (ex.: "Sem permissão
para consultar o score (read:scores)"). Os perfis acima já contemplam essas combinações.
Optamos pelo relay em vez de Machine-to-Machine (client credentials) porque mantém a identidade e
as permissões do usuário de ponta a ponta, sem secrets extras nem cota de tokens M2M.

## Configuração no painel do Auth0 (uma vez)

Em https://manage.auth0.com, tenant `dev-slbrfj6dwk1pdeox`:

1. **Applications → APIs → Create API**: Name `ERP Banking API`, Identifier
   `https://erp-banking-api` (não pode ser alterado depois), Signing Algorithm RS256.
2. Na API criada, aba **Settings**:
   - RBAC Settings: ligar **Enable RBAC** e **Add Permissions in the Access Token**;
   - Access Settings: ligar **Allow Offline Access** (refresh token para o front);
   - salvar.
3. Aba **Permissions**: cadastrar as 8 permissões da tabela acima.
4. **User Management → Roles**: criar `admin`, `analista` e `atendente` e, em cada um,
   **Permissions → Add Permissions → ERP Banking API**, marcando as permissões do perfil.
5. **User Management → Users**: em cada usuário, **Roles → Assign Roles**. Usuários novos podem
   se cadastrar pelo botão "Criar conta" do front e depois receber o perfil.
6. **Applications → Applications → (a SPA)**, aba Settings:
   - _Allowed Callback URLs_, _Allowed Logout URLs_ e _Allowed Web Origins_: `http://localhost:5173`
     (e, na Etapa 4, o domínio da Vercel, separados por vírgula);
   - _Refresh Token Rotation_: ligar **Rotation**.

Depois de mudar permissões ou perfis, o usuário precisa **sair e entrar de novo** para receber um
token com as permissões atualizadas.

### Problemas comuns

| Sintoma                                                           | Causa / solução                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Login volta com `access_denied: Service not found`                | A API `https://erp-banking-api` não existe no tenant (passo 1)                   |
| Login volta com `... is not authorized to access resource server` | Autorizar a SPA na aba **Application Access** da API                             |
| APIs respondem 401 com o usuário logado                           | Audience diferente entre front (`VITE_AUTH0_AUDIENCE`) e APIs (`AUTH0_AUDIENCE`) |
| APIs respondem 403 em tudo                                        | Usuário sem perfil, ou RBAC sem "Add Permissions in the Access Token"            |
| Erro de CORS no navegador                                         | Origem do front fora de `CORS_ORIGINS` da API                                    |

## Como cada parte implementa

- **Front** (`src/components/auth/`, `src/hooks/`, `src/services/http.ts`):
  `Auth0Provider` com `audience`, cache em `localStorage` e refresh token; `useApi` cria os clients
  com um interceptor que injeta o access token; `RequireAuth` protege as rotas; `usePermissions`
  lê a claim `permissions` do token e `Can`/`RequirePermission` adaptam a interface. A interface
  só esconde o que o usuário não pode fazer: **quem garante o acesso são as APIs**.
- **Onboarding e Credit Score** (FastAPI): `require_auth` valida o JWT com `PyJWT`/`PyJWKClient`
  e devolve um `Principal`; `require_permission("...")` responde 403. O `OnboardingClient` do
  Score repassa o token.
- **Transactions** (Spring Security, resource server): `NimbusJwtDecoder` com validação de issuer,
  audience, expiração e `sub`; um conversor transforma `permissions`/`scope` em authorities e o
  `SecurityFilterChain` exige a authority de cada rota. O `BearerTokenRelayInterceptor` repassa o
  token nas chamadas ao Score.

## Testes

Nenhum teste chama o Auth0. Python: chaves RSA geradas no teste e `PyJWKClient` mockado; demais
testes sobrescrevem `require_auth`. Java: `spring-security-test` (`jwt()` com authorities) e JWKS
local. Front: `useAuth0` mockado com um JWT de teste contendo `permissions`.
