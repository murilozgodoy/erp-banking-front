# Etapa 3 — Auth0 + Frontend (entrega 21/10/2026)

## Escopo

- Integrar **Auth0 (OAuth 2.0 + JWT)** nos 3 serviços.
- Implementar o frontend neste repositório.

## Decisões tomadas

| Tema              | Decisão                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Framework         | React 19 + Vite, TypeScript                                                               |
| Estilo            | Tailwind CSS v4 (`@tailwindcss/vite`)                                                     |
| Roteamento / HTTP | React Router 7 + Axios                                                                    |
| Qualidade         | ESLint (flat config) + Prettier (com plugin de classes Tailwind)                          |
| URLs das APIs     | Uma variável por serviço (`VITE_*_API_URL`), lidas só em `src/config/env.ts`              |
| Organização       | `components/` (reutilizáveis), `pages/` (uma por rota), `routes/`, `services/`, `config/` |

## Decisões em aberto

- Fluxo de login (Auth0 Universal Login? Social?)
- Telas mínimas (onboarding + score + crédito?)
- Expor os 3 serviços direto ou colocar um gateway básico (oficialmente Etapa 4)?
- Testes de frontend (Vitest + Testing Library) e CI no GitHub Actions.

## Estrutura do front

```
src/
├── components/   # componentes reutilizáveis (layout/ para estrutura da página)
├── pages/        # uma página por rota
├── routes/       # definição do roteador
├── services/     # clients Axios e chamadas às APIs
└── config/       # leitura validada das variáveis de ambiente
```
