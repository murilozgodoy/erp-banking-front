# APIs da Fase 2 (Portal do Cliente ErpIa)

Rotas novas da Fase 2 nos três serviços, como estão no `main`. As rotas da Etapa 4 continuam em
[apis.md](apis.md); a visão do produto e os fluxos ficam em [portal-cliente.md](portal-cliente.md). Os exemplos
usam valores fictícios.

## Convenções

- **Gateway:** pelo API Gateway (nginx, porta 8080) acrescente o prefixo do serviço; na Vercel, o front chama
  `/api/<prefixo>/...`, que o `vercel.json` reescreve para o gateway.

  | Prefixo         | Serviço          | Exemplo pelo gateway             | Pela Vercel                     |
  | --------------- | ---------------- | -------------------------------- | ------------------------------- |
  | `/onboarding`   | Onboarding API   | `GET /onboarding/me` → `GET /me` | `/api/onboarding/me`            |
  | `/score`        | Credit Score API | `GET /score/me/analysis`         | `/api/score/me/analysis`        |
  | `/transactions` | Transactions API | `GET /transactions/me/overview`  | `/api/transactions/me/overview` |

  Atenção às rotas que já começam com `/onboarding`: pelo gateway, `GET /onboarding/templates` vira
  `GET /onboarding/onboarding/templates`.

- **Autenticação:** `Authorization: Bearer <access token do Auth0>`. Sem token ou com token inválido: 401. Sem a
  permissão do token (Auth0 RBAC): 403. Nos serviços Python o corpo é `{"detail": "Missing permission: read:self"}`.
- **Permissões do token:** `read:self` (GET do cliente), `write:self` (escritas do cliente) e
  `review:onboarding` / `read:scores` (staff).
- **Permissões da empresa:** vêm de `membro.permissoes` no `GET /me` do Onboarding. Falta uma → 403
  `{"error":"SEM_PERMISSAO","permissao":"<permissão>"}`. Membro suspenso → 403 `{"error":"MEMBRO_SUSPENSO"}` em
  qualquer rota `/me`. Mudanças valem em até 60 s (cache de `GET /me` no Score e no Transactions).
- **Erros de negócio** sempre com um código estável em `error` (ex.: `{"error":"ONBOARDING_PENDENTE","status":"EM_ANALISE"}`).
  A validação de corpo do FastAPI responde 422 no formato padrão (`{"detail":[{"loc", "msg", "type"}]}`); a do
  Transactions responde 400 `{"error":"validation_failed","message":"...","campos":{...}}`.

## Onboarding API (`/onboarding`)

| Método e rota                            | Permissão do token  | Permissão da empresa  | Descrição                                 |
| ---------------------------------------- | ------------------- | --------------------- | ----------------------------------------- |
| `GET /onboarding/templates`              | autenticado         | —                     | Templates de todos os segmentos           |
| `GET /onboarding/templates/{segmento}`   | autenticado         | —                     | Um template (404 se não existir)          |
| `GET /me`                                | `read:self`         | —                     | Empresa e membro do `sub`                 |
| `GET /me/onboarding`                     | `read:self`         | qualquer membro ATIVO | Rascunho ou envio atual                   |
| `PUT /me/onboarding`                     | `write:self`        | só o DONO             | Salva o rascunho ou envia para análise    |
| `GET /onboarding/reviews?status=`        | `review:onboarding` | —                     | Fila de análise (padrão `ANALISE_MANUAL`) |
| `POST /onboarding/reviews/{id}/decision` | `review:onboarding` | —                     | Decisão do analista                       |
| `GET /me/team`                           | `read:self`         | `gerenciar_equipe`    | Membros da empresa (DONO primeiro)        |
| `POST /me/team/invites`                  | `write:self`        | `gerenciar_equipe`    | Convida uma pessoa                        |
| `PATCH /me/team/{id}`                    | `write:self`        | `gerenciar_equipe`    | Papel, permissões, limite ou status       |
| `DELETE /me/team/{id}`                   | `write:self`        | `gerenciar_equipe`    | Revoga o convite ou remove o membro (204) |
| `POST /me/team/invites/{token}/accept`   | `read:self`         | —                     | Aceita o convite                          |

### `GET /onboarding/templates`

```json
[
  {
    "segmento": "varejo",
    "versao": "2026-11-03",
    "nome": "Varejo e e-commerce",
    "descricao": "Lojas físicas e online",
    "icone": "store",
    "secoes": [
      {
        "id": "vendas",
        "titulo": "Como você vende",
        "campos": [
          {
            "id": "faturamento_mensal",
            "label": "Faturamento médio mensal",
            "tipo": "currency",
            "obrigatorio": true,
            "ajuda": "Média dos últimos 12 meses, antes de impostos."
          },
          {
            "id": "parcelamento_medio",
            "label": "Parcelamento médio (vezes)",
            "tipo": "number",
            "obrigatorio": false,
            "min": 1,
            "max": 24
          }
        ]
      },
      { "id": "operacao", "titulo": "Operação", "campos": [] },
      { "id": "financeiro", "titulo": "Financeiro", "campos": [] }
    ]
  }
]
```

Tipos de campo: `currency|percent|number|integer|select|multiselect|boolean|text` (`opcoes` nos dois `select`).
Campos comuns com o mesmo id em todos os segmentos: `faturamento_mensal`, `margem_bruta_pct`, `sazonalidade`,
`prazo_medio_recebimento_dias`, `prazo_medio_pagamento_dias`, `folha_mensal`, `possui_estoque`, `valor_estoque`,
`dividas_total`, `parcela_dividas_mensal`.

### `GET /me`

```json
{
  "customer_id": 42,
  "onboarding_status": "APROVADO",
  "empresa": {
    "razao_social": "Aurora Pães Ltda",
    "nome_fantasia": "Aurora Pães",
    "cnpj": "11222333000181",
    "email": "financeiro@aurora.com.br",
    "telefone": "4133221144",
    "cidade": "Curitiba",
    "estado": "PR",
    "fundacao_ano": 2015,
    "funcionarios": 18
  },
  "membro": {
    "id": 7,
    "nome": "Marina Souza",
    "email": "marina@aurora.com.br",
    "papel": "OPERADOR",
    "permissoes": ["ver_financeiro", "pagar", "gerenciar_estoque", "usar_assistente"],
    "limite_pagamento": 1500.0,
    "status": "ATIVO"
  }
}
```

Sem empresa: `{"customer_id": null, "onboarding_status": "NAO_INICIADO", "empresa": null, "membro": null}`. O DONO
tem sempre todas as permissões. `membro.nome` e `membro.email` são extras ao contrato (auditoria no Transactions).

### `GET /me/onboarding` e `PUT /me/onboarding`

Corpo do `PUT` (o corpo **substitui** o estado salvo; `empresa` é validada também no rascunho):

```json
{
  "empresa": { "razao_social": "Aurora Pães Ltda", "cnpj": "11.222.333/0001-81", "estado": "PR" },
  "segmento": "alimentacao",
  "respostas": { "faturamento_mensal": 182000, "margem_bruta_pct": 38, "possui_estoque": true },
  "observacoes": "Padaria com duas lojas e entrega por aplicativo.",
  "enviar": false
}
```

Resposta (igual à do `GET`):

```json
{
  "empresa": { "razao_social": "Aurora Pães Ltda", "cnpj": "11222333000181", "estado": "PR" },
  "segmento": "alimentacao",
  "respostas": { "faturamento_mensal": 182000, "margem_bruta_pct": 38, "possui_estoque": true },
  "observacoes": "Padaria com duas lojas e entrega por aplicativo.",
  "onboarding_status": "RASCUNHO",
  "updated_at": "2026-11-03T18:02:11",
  "review_comment": null,
  "reviewed_at": null
}
```

`enviar=true` exige `razao_social`, `cnpj`, `email`, `telefone`, `cidade`, `estado`, o `segmento` e as respostas
obrigatórias do template; muda para `EM_ANALISE` e publica `customer.onboarding_submitted`. `review_comment` e
`reviewed_at` só aparecem depois de uma decisão manual.

| Status | Corpo                                                                                                            | Quando                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 422    | `{"detail":"Onboarding incompleto ou inválido","campos":[{"campo":"empresa.cnpj","erro":"Campo obrigatório."}]}` | Envio incompleto (nada é salvo)                    |
| 422    | formato padrão do FastAPI                                                                                        | CNPJ com DV inválido, UF inválida, segmento errado |
| 409    | `{"detail":"Onboarding em EM_ANALISE não pode ser alterado"}`                                                    | Status fora de `RASCUNHO` ou `REPROVADO`           |
| 409    | `{"detail":"CNPJ 11222333000181 já cadastrado"}`                                                                 | CNPJ de outra empresa                              |
| 403    | `{"error":"SEM_PERMISSAO","permissao":"dono"}`                                                                   | Membro que não é o DONO                            |

### Fila de análise (staff)

`GET /onboarding/reviews?status=ANALISE_MANUAL` (também aceita `RASCUNHO`, `EM_ANALISE`, `APROVADO`, `REPROVADO`),
em ordem de envio. `analise` é o resumo recebido no evento do Score; a análise completa está em
`GET /scores/analyses/{customer_id}`.

```json
[
  {
    "customer_id": 42,
    "empresa": { "razao_social": "Aurora Pães Ltda", "cnpj": "11222333000181" },
    "segmento": "outro",
    "observacoes": "Padaria com cozinha industrial que também vende para restaurantes.",
    "analise": {
      "score": 655,
      "faixa_risco": "MEDIO",
      "gerado_por": "llm+regras",
      "status": "ANALISE_MANUAL"
    },
    "submitted_at": "2026-11-03T18:05:40"
  }
]
```

`POST /onboarding/reviews/{customer_id}/decision` com `{"decisao": "APROVADO", "comentario": "Documentos ok."}`
(`decisao` = `APROVADO|REPROVADO`, comentário de até 2.000 caracteres):

```json
{
  "customer_id": 42,
  "onboarding_status": "APROVADO",
  "decisao": "APROVADO",
  "comentario": "Documentos ok.",
  "reviewer": "auth0|analista-123",
  "reviewed_at": "2026-11-03T18:20:02"
}
```

Erros: 404 `{"detail":"Onboarding do cliente 42 não encontrado"}`; 409
`{"detail":"Decisão só é permitida em ANALISE_MANUAL (status atual: APROVADO)"}` (inclusive quando outro analista
decidiu antes).

### Equipe (`/me/team`)

`GET /me/team`:

```json
[
  {
    "id": 3,
    "nome": "Aurora Pães Ltda",
    "email": "financeiro@aurora.com.br",
    "papel": "DONO",
    "permissoes": [
      "ver_financeiro",
      "pagar",
      "aprovar_pagamentos",
      "pedir_credito",
      "contratar_credito",
      "gerenciar_estoque",
      "gerenciar_equipe",
      "usar_assistente"
    ],
    "limite_pagamento": null,
    "status": "ATIVO",
    "convite_expira_em": null,
    "created_at": "2026-11-03T18:02:11",
    "updated_at": "2026-11-03T18:02:11"
  }
]
```

`POST /me/team/invites` com `{"email": "marina@aurora.com.br", "nome": "Marina Souza", "papel": "OPERADOR",
"limite_pagamento": 1500}` (`papel` = `ADMIN|FINANCEIRO|OPERADOR|LEITURA`; sem `permissoes`, usa o preset) → 201:

```json
{
  "membro": {
    "id": 7,
    "nome": "Marina Souza",
    "papel": "OPERADOR",
    "status": "CONVIDADO",
    "convite_expira_em": "2026-11-10T18:30:00"
  },
  "convite_url": "https://erp-banking-front.vercel.app/convite/<token>"
}
```

O token só aparece nesta resposta (guardado como sha256, válido por 7 dias). `PATCH /me/team/{id}` aceita
`{papel?, permissoes?, limite_pagamento?, status?: "ATIVO"|"SUSPENSO"}` e devolve o item atualizado; trocar o papel
sem mandar `permissoes` aplica o preset, e `limite_pagamento: null` remove o limite. `DELETE /me/team/{id}` → 204.

`POST /me/team/invites/{token}/accept` → `{"customer_id": 42, "membro": {...}}` (mesmo formato do `membro` de
`GET /me`). É idempotente para o mesmo `sub`.

| Status | `error`                  | Quando                                                          |
| ------ | ------------------------ | --------------------------------------------------------------- |
| 403    | `SEM_PERMISSAO`          | Sem `gerenciar_equipe`, ou concedendo uma permissão que não tem |
| 403    | `DONO_PROTEGIDO`         | Editar, suspender ou remover o DONO                             |
| 403    | `AUTO_EDICAO`            | Editar ou remover a si mesmo                                    |
| 404    | `MEMBRO_NAO_ENCONTRADO`  | Id inexistente ou de outra empresa                              |
| 409    | `DONO_UNICO`             | O DONO tentando promover alguém a DONO                          |
| 409    | `EMAIL_JA_CADASTRADO`    | E-mail já existe na empresa (qualquer status)                   |
| 409    | `CONVITE_PENDENTE`       | Mudar o status de um convite ainda não aceito                   |
| 409    | `CONFLITO_CONCORRENTE`   | Edição simultânea do mesmo membro                               |
| 404    | `CONVITE_NAO_ENCONTRADO` | Aceite com token desconhecido                                   |
| 410    | `CONVITE_EXPIRADO`       | Aceite depois de 7 dias                                         |
| 409    | `JA_VINCULADO`           | O `sub` já é dono ou membro de uma empresa                      |

## Credit Score API (`/score`)

| Método e rota                                    | Permissão do token | Permissão da empresa | Descrição                                       |
| ------------------------------------------------ | ------------------ | -------------------- | ----------------------------------------------- |
| `GET /me/analysis`                               | `read:self`        | —                    | Análise vigente do negócio do cliente           |
| `GET /scores/analyses/{customer_id}`             | `read:scores`      | — (staff)            | Análise vigente de qualquer cliente             |
| `POST /me/assistant/messages`                    | `read:self`        | `usar_assistente`    | Pergunta ao Assistente ErpIa                    |
| `GET /me/assistant/conversations?limit=&offset=` | `read:self`        | `usar_assistente`    | Conversas do usuário (limit até 100, padrão 20) |
| `GET /me/assistant/conversations/{id}`           | `read:self`        | `usar_assistente`    | Mensagens de uma conversa                       |
| `DELETE /me/assistant/conversations/{id}`        | `read:self`        | `usar_assistente`    | Apaga uma conversa (soft delete, 204)           |
| `DELETE /me/assistant/conversations`             | `read:self`        | `usar_assistente`    | Apaga todo o histórico (LGPD, 204)              |

### `GET /me/analysis` e `GET /scores/analyses/{customer_id}`

```json
{
  "customer_id": 42,
  "status": "ANALISE_MANUAL",
  "score": 655,
  "faixa_risco": "MEDIO",
  "resumo": "Padaria com margem saudável e caixa apertado no fim do mês.",
  "gerado_por": "llm+regras",
  "atualizado_em": "2026-11-03T18:05:52Z",
  "kpis": [
    {
      "id": "receita_mensal",
      "label": "Receita mensal",
      "valor": 182000,
      "unidade": "BRL",
      "benchmark_segmento": 150000,
      "leitura": "acima da média do segmento"
    }
  ],
  "insights": [
    {
      "area": "recebiveis",
      "titulo": "Recebíveis no cartão",
      "texto": "R$ 120 mil a receber nos próximos 90 dias.",
      "severidade": "oportunidade"
    }
  ],
  "oportunidades": [
    {
      "tipo": "ANTECIPACAO_RECEBIVEIS",
      "titulo": "Antecipação de recebíveis",
      "descricao": "…",
      "valor_maximo": 42000,
      "taxa_mensal": 2.09,
      "prazo_max_meses": 6,
      "racional": "…"
    }
  ],
  "pontos_fortes": ["Margem bruta acima do segmento"],
  "riscos": ["Prazo de recebimento longo"],
  "motivos_revisao": [
    { "codigo": "SEGMENTO_OUTRO", "descricao": "Segmento 'outro' sempre vai para a análise manual" }
  ]
}
```

- `status`: `APROVADO`, `ANALISE_MANUAL`, `EM_ANALISE` ou `REPROVADO` (a decisão humana vira uma nova versão).
- KPI ids: `receita_mensal`, `margem_bruta_pct`, `ticket_medio`, `prazo_medio_recebimento_dias`,
  `prazo_medio_pagamento_dias`, `ciclo_caixa_dias`, `endividamento_sobre_receita`,
  `comprometimento_parcelas_pct` e `cobertura_estoque_dias` (com estoque). Sem resposta: `valor: null`.
- `motivos_revisao` (extra ao contrato): `SEGMENTO_OUTRO`, `LLM_ESPECIFICO`, `LLM_BAIXA_CONFIANCA`,
  `RECEITA_INVALIDA`, `DIVIDA_EXCESSIVA`, `PARCELAS_EXCESSIVAS`, `MARGEM_NEGATIVA`, `RISCO_MUITO_ALTO`; vazio em
  `APROVADO`.
- Onboarding enviado e análise ainda não pronta: 200 com `status: "EM_ANALISE"` e os demais campos nulos ou vazios.

| Status | Corpo                                                         | Quando                                     |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| 404    | `{"error":"ONBOARDING_NAO_INICIADO","status":"NAO_INICIADO"}` | `/me/analysis` sem empresa                 |
| 404    | `{"error":"ANALISE_NAO_ENCONTRADA","status":"RASCUNHO"}`      | `/me/analysis` sem análise e fora de envio |
| 404    | `{"detail":"Nenhuma análise para o cliente 42"}`              | `/scores/analyses/{id}` sem análise        |
| 403    | `{"error":"MEMBRO_SUSPENSO"}`                                 | Membro suspenso                            |
| 502    | `{"detail":"..."}`                                            | Onboarding fora do ar                      |

### `POST /me/assistant/messages`

```json
{
  "messages": [{ "role": "user", "content": "Quanto consigo antecipar sem apertar dezembro?" }],
  "rota": "/app/recebiveis",
  "conversation_id": "5f0c6a1e-2b7d-4c1a-9a51-0f2b1c3d4e5f"
}
```

De 1 a 20 mensagens de até 2.000 caracteres, a última sempre do usuário. Sem `conversation_id`, cria uma
conversa (título = 1ª pergunta, até 80 caracteres); com ele, o histórico vem do banco (20 últimas mensagens) e só a
última mensagem do corpo conta.

```json
{
  "resposta": "Você tem **R$ 120.400,00** previstos para os próximos 90 dias. Antecipar **R$ 42 mil** custa ...",
  "sugestoes": ["Quais semanas concentram mais recebimentos?", "Simule em 3 meses."],
  "fontes": [
    { "tipo": "recebiveis", "label": "Recebíveis" },
    { "tipo": "credito", "label": "Simulação de crédito" }
  ],
  "acoes": [
    {
      "label": "Simular antecipação",
      "rota": "/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=42000"
    }
  ],
  "conversation_id": "5f0c6a1e-2b7d-4c1a-9a51-0f2b1c3d4e5f",
  "message_id": 128
}
```

| Status | Corpo                                                     | Quando                                                                                                         |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 503    | `{"error":"ASSISTENTE_INDISPONIVEL"}`                     | Sem `ANTHROPIC_API_KEY`, falha ou prazo de 45 s estourado (com `conversation_id` se a pergunta já foi gravada) |
| 429    | `{"error":"LIMITE_ASSISTENTE"}` + `Retry-After`           | Mais de 10 mensagens por minuto por `sub`                                                                      |
| 409    | `{"error":"ONBOARDING_PENDENTE","status":"EM_ANALISE"}`   | Empresa não `APROVADO`                                                                                         |
| 403    | `{"error":"SEM_PERMISSAO","permissao":"usar_assistente"}` | Membro sem `usar_assistente`                                                                                   |
| 404    | `{"error":"CONVERSA_NAO_ENCONTRADA"}`                     | Conversa inexistente, de outro `sub` ou apagada                                                                |
| 422    | formato padrão do FastAPI                                 | Corpo inválido (ex.: última mensagem não é do usuário)                                                         |

### Histórico

`GET /me/assistant/conversations?limit=20&offset=0`:

```json
[
  {
    "id": "5f0c6a1e-2b7d-4c1a-9a51-0f2b1c3d4e5f",
    "titulo": "Quanto consigo antecipar sem apertar dezembro?",
    "updated_at": "2026-11-03T19:12:40+00:00",
    "mensagens": 4
  }
]
```

`GET /me/assistant/conversations/{id}`:

```json
{
  "id": "5f0c6a1e-2b7d-4c1a-9a51-0f2b1c3d4e5f",
  "titulo": "Quanto consigo antecipar sem apertar dezembro?",
  "mensagens": [
    {
      "id": 127,
      "role": "user",
      "content": "Quanto consigo antecipar sem apertar dezembro?",
      "fontes": [],
      "acoes": [],
      "sugestoes": [],
      "created_at": "2026-11-03T19:12:31+00:00"
    },
    {
      "id": 128,
      "role": "assistant",
      "content": "Você tem **R$ 120.400,00** ...",
      "fontes": [{ "tipo": "recebiveis", "label": "Recebíveis" }],
      "acoes": [],
      "sugestoes": [],
      "created_at": "2026-11-03T19:12:40+00:00"
    }
  ]
}
```

Nunca traz a saída das ferramentas. Os dois `DELETE` respondem 204 (o de tudo é idempotente); uma conversa
inexistente ou de outro `sub` dá 404 `CONVERSA_NAO_ENCONTRADA`. As apagadas somem do banco depois de 30 dias.

## Transactions API (`/transactions`)

Toda rota `/me` exige `read:self` (GET) ou `write:self` (POST) no token e resolve a empresa pelo `GET /me` do
Onboarding. Erros comuns a todas:

| Status | Corpo                                                    | Quando                                                                             |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 409    | `{"error":"ONBOARDING_PENDENTE","status":"EM_ANALISE"}`  | Sem empresa ou status diferente de `APROVADO`                                      |
| 403    | `{"error":"SEM_PERMISSAO","permissao":"ver_financeiro"}` | Membro sem a permissão da rota                                                     |
| 403    | `{"error":"MEMBRO_SUSPENSO"}`                            | Membro suspenso                                                                    |
| 503    | `{"error":"ONBOARDING_INDISPONIVEL"}`                    | Onboarding fora do ar                                                              |
| 400    | `{"error":"PARAMETRO_INVALIDO","mensagem":"..."}`        | `status`, `group_by` ou datas inválidos; `from > to`; período de vendas > 400 dias |

| Método e rota                           | Permissão da empresa                   | Descrição                                                 |
| --------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| `GET /me/overview`                      | `ver_financeiro`                       | Saldo, conta, KPIs de 30 dias e fluxo de caixa de 60 dias |
| `GET /me/sales?from=&to=&group_by=`     | `ver_financeiro`                       | Vendas (padrão: últimos 30 dias, por dia)                 |
| `GET /me/receivables?status=&from=&to=` | `ver_financeiro`                       | Agenda de recebíveis                                      |
| `GET /me/payables?status=`              | `ver_financeiro`                       | Contas a pagar                                            |
| `GET /me/statement?from=&to=`           | `ver_financeiro`                       | Extrato com saldo após cada lançamento                    |
| `GET /me/inventory`                     | `ver_financeiro`                       | Estoque                                                   |
| `POST /me/inventory/{id}/movements`     | `gerenciar_estoque`                    | Entrada, saída ou ajuste de um item (201)                 |
| `GET /me/inventory/{id}/movements`      | `ver_financeiro`                       | Histórico do item (até 100, mais recente primeiro)        |
| `GET /me/pendencias`                    | `ver_financeiro`                       | Pendências em ordem de urgência                           |
| `POST /me/payments`                     | `pagar`                                | Paga ou agenda PIX, boleto ou TED                         |
| `GET /me/payments`                      | `ver_financeiro`                       | Histórico de pagamentos                                   |
| `GET /me/credit/offers`                 | `ver_financeiro`                       | Limite disponível por produto                             |
| `POST /me/credit/simulations`           | `pedir_credito`                        | Simulação (201, válida por 7 dias)                        |
| `POST /me/credit/requests`              | `contratar_credito` ou `pedir_credito` | Pedido de crédito (201)                                   |
| `POST /me/credit/requests/{id}/confirm` | `contratar_credito`                    | Contrata um pedido `AGUARDANDO_CONTRATACAO` (extra)       |
| `GET /me/credit/requests`               | `ver_financeiro`                       | Propostas e contratos                                     |

### Leituras

`GET /me/overview`:

```json
{
  "saldo": 31870.45,
  "conta": { "id": 48213, "agencia": "0001", "numero": "48213-5" },
  "receita_30d": 182340.1,
  "receita_30d_variacao_pct": 6.4,
  "ticket_medio_30d": 61.2,
  "recebiveis_90d": 120400.0,
  "a_pagar_30d": 98500.0,
  "atrasados_total": 4200.0,
  "estoque_valor": 35800.0,
  "pendencias_count": 7,
  "fluxo_caixa": [
    { "data": "2026-11-04", "entradas": 5400.0, "saidas": 2100.0, "saldo_projetado": 35170.45 }
  ]
}
```

`GET /me/sales?group_by=week` → `{serie: [{periodo, valor, quantidade}], por_forma_pagamento: [{forma, valor, pct}],
por_canal: [{canal, valor, pct}], top_produtos: [{sku, nome, valor, quantidade}], total, ticket_medio}`.
`forma`: `PIX|CARTAO_CREDITO|CARTAO_DEBITO|BOLETO|DINHEIRO`; `group_by`: `day|week|month`.

`GET /me/receivables?status=PREVISTO` → `{itens: [{id, vencimento, valor_bruto, valor_liquido, adquirente,
status}], total_previsto, por_semana: [{semana, valor}]}`; `status`: `PREVISTO|RECEBIDO|ANTECIPADO`.

`GET /me/payables?status=ATRASADO` → `{itens: [{id, fornecedor, categoria, vencimento, valor, status,
codigo_barras, pago_em}], total_aberto, total_atrasado, proximos_7d}`; `status`: `ABERTO|PAGO|ATRASADO|AGENDADO`
(conta aberta vencida sai como `ATRASADO`).

`GET /me/statement` → `[{id, data, tipo: "CREDIT"|"DEBIT", valor, saldo_apos, descricao}]`, mais recente
primeiro (padrão: 30 dias).

`GET /me/inventory` → `{itens: [{id, sku, nome, quantidade, minimo, custo_unitario, preco_venda, giro_dias,
ultima_venda, cobertura_dias, abaixo_minimo, parado}], valor_total, valor_parado, abaixo_minimo,
cobertura_media_dias}` (parado = giro acima de 90 dias).

`GET /me/pendencias`:

```json
[
  {
    "id": "saldo-insuficiente",
    "tipo": "SALDO_INSUFICIENTE",
    "titulo": "Saldo insuficiente para os próximos 7 dias",
    "descricao": "Você tem R$ 40.100,00 em contas vencendo nos próximos 7 dias e R$ 31.870,45 em conta. ...",
    "valor": 8229.55,
    "data": "2026-11-03",
    "acao": {
      "label": "Simular capital de giro",
      "rota": "/app/credito",
      "credito": { "produto": "CAPITAL_DE_GIRO", "valor": 8229.55 }
    }
  }
]
```

`tipo`: `CONTA_ATRASADA`, `SALDO_INSUFICIENTE`, `VENCE_HOJE`, `PROPOSTA_CREDITO`, `ESTOQUE_BAIXO`,
`ESTOQUE_PARADO` (nessa ordem de urgência). Os ids são estáveis (ex.: `payable-12`, `inventory-low-7`).

### Estoque

`POST /me/inventory/{id}/movements` (`gerenciar_estoque`) registra uma entrada, uma saída ou um ajuste:

```json
{ "tipo": "ENTRADA", "quantidade": 18, "motivo": "NF 4512", "custo_unitario": 25.9 }
```

- `tipo`: `ENTRADA|SAIDA|AJUSTE`. Na `ENTRADA` e na `SAIDA`, `quantidade` é o que entra ou sai (inteiro > 0,
  até 1.000.000). No `AJUSTE`, é a quantidade final contada (inteiro ≥ 0).
- `motivo`: opcional, até 200 caracteres.
- `custo_unitario`: opcional, só na `ENTRADA` (> 0). Atualiza o custo do item pela média ponderada
  (`(saldo × custo atual + quantidade × custo_unitario) / saldo final`).

Resposta 201, com o item já recalculado (mesmo formato de `GET /me/inventory` → `itens[]`):

```json
{
  "movimento": {
    "id": 101,
    "item_id": 1,
    "tipo": "ENTRADA",
    "quantidade": 18,
    "quantidade_anterior": 12,
    "quantidade_final": 30,
    "custo_unitario": 25.9,
    "motivo": "NF 4512",
    "created_by_nome": "Marina Costa",
    "created_at": "2026-11-03T14:32:10Z"
  },
  "item": {
    "id": 1,
    "sku": "PANETONE-ART",
    "quantidade": 30,
    "minimo": 15,
    "abaixo_minimo": false,
    "...": "..."
  }
}
```

| Status | Corpo                                                                         | Quando                               |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------ |
| 422    | `{"error":"ESTOQUE_INSUFICIENTE","message":"...","disponivel":12}`            | A `SAIDA` deixaria o saldo negativo  |
| 404    | `{"error":"ITEM_NAO_ENCONTRADO","message":"..."}`                             | Item inexistente ou de outra empresa |
| 400    | `{"error":"validation_failed","message":"...","campos":{"quantidade":"..."}}` | Corpo inválido (mensagem por campo)  |
| 403    | `{"error":"SEM_PERMISSAO","permissao":"gerenciar_estoque"}`                   | Membro sem a permissão               |

`GET /me/inventory/{id}/movements` (`ver_financeiro`) → `[movimento…]` no mesmo formato, do mais recente para o
mais antigo (até 100); 404 `ITEM_NAO_ENCONTRADO` como acima.

Os indicadores (`abaixo_minimo`, `valor_parado`, `valor_total`, `cobertura_*`) e as pendências `ESTOQUE_BAIXO` e
`ESTOQUE_PARADO` são calculados na hora: a `ESTOQUE_BAIXO` some quando o item volta ao mínimo. No front, depois de
um movimento, a aba Estoque invalida o estoque, as pendências e a visão geral (o selo do menu vem delas).

### Pagamentos

`POST /me/payments`:

```json
{
  "tipo": "BOLETO",
  "valor": 1250.0,
  "destinatario": "Moinho Paraná",
  "descricao": "Farinha, NF 1234",
  "payable_id": 12,
  "agendado_para": null,
  "codigo_barras": "34191790010104351004791020150008291070026000"
}
```

201:

```json
{
  "id": 301,
  "status": "EFETIVADO",
  "autenticacao": "A1B2C3D4E5F6",
  "saldo_apos": 30620.45,
  "comprovante": {
    "tipo": "BOLETO",
    "valor": 1250.0,
    "destinatario": "Moinho Paraná",
    "descricao": "Farinha, NF 1234",
    "data_hora": "2026-11-03T19:30:00Z",
    "autenticacao": "A1B2C3D4E5F6",
    "conta_origem": { "id": 48213, "agencia": "0001", "numero": "48213-5" },
    "codigo_barras": "34191790010104351004791020150008291070026000"
  }
}
```

Com `agendado_para` futuro, `status: "AGENDADO"` e nada é debitado agora (um job efetiva no dia). `GET
/me/payments` → `[{id, tipo, valor, destinatario, descricao, payable_id, agendado_para, codigo_barras, status,
autenticacao, criado_em, created_by_nome}]`.

| Status | Corpo                                                              | Quando                                       |
| ------ | ------------------------------------------------------------------ | -------------------------------------------- |
| 422    | `{"error":"SALDO_INSUFICIENTE","faltam":250.0}`                    | Saldo não cobre                              |
| 422    | `{"error":"VALOR_DIVERGENTE","message":"..."}`                     | Valor diferente do da conta a pagar          |
| 422    | `{"error":"CONTA_JA_PAGA" ou "CONTA_JA_AGENDADA","message":"..."}` | Conta a pagar já paga ou agendada            |
| 404    | `{"error":"CONTA_A_PAGAR_NAO_ENCONTRADA","message":"..."}`         | `payable_id` inexistente ou de outra empresa |
| 400    | `{"error":"validation_failed","message":"...","campos":{...}}`     | Corpo inválido ou `agendado_para` no passado |

#### Aprovação de pagamentos acima do limite

Se o `valor` passa do `limite_pagamento` do membro, `POST /me/payments` responde 201 com `"status":
"PENDENTE_APROVACAO"` e nada é debitado. A conta a pagar fica travada para outro pagamento enquanto houver um
pendente (`422 PAGAMENTO_PENDENTE`).

| Método e rota                    | Permissão            | Resposta                                                                       |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| `GET /me/payments/pending`       | `aprovar_pagamentos` | Pendentes da empresa, do mais recente ao mais antigo (mesmo item do histórico) |
| `POST /me/payments/{id}/approve` | `aprovar_pagamentos` | Executa o pagamento (débito ou agendamento) e devolve o mesmo corpo do `POST`  |
| `POST /me/payments/{id}/reject`  | `aprovar_pagamentos` | Corpo opcional `{"motivo": "..."}` (até 255); devolve o item com `REJEITADO`   |

O item do histórico ganha `approved_by_nome`, `approved_at`, `rejected_by_nome`, `rejected_at` e
`motivo_rejeicao`. Status possíveis: `EFETIVADO`, `AGENDADO`, `PENDENTE_APROVACAO` e `REJEITADO`.

| Status | Corpo                                                                         | Quando                                         |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| 403    | `{"error":"SEM_PERMISSAO","permissao":"aprovar_pagamentos","motivo":"AUTOR"}` | Quem pagou tenta aprovar ou rejeitar o próprio |
| 404    | `{"error":"PAGAMENTO_NAO_ENCONTRADO","message":"..."}`                        | Id inexistente ou de outra empresa             |
| 422    | `{"error":"PAGAMENTO_NAO_PENDENTE","message":"..."}`                          | Já aprovado, rejeitado ou não pendente         |
| 422    | `{"error":"SALDO_INSUFICIENTE","faltam":250.0}`                               | Na aprovação, o saldo não cobre                |

### Crédito

`GET /me/credit/offers` → `[{"produto": "ANTECIPACAO_RECEBIVEIS", "limite": 96320.0, "taxa_mensal_a_partir":
2.0900, "prazo_max_meses": 6}]`. Produtos ofertados: `ANTECIPACAO_RECEBIVEIS` (6 meses), `CAPITAL_DE_GIRO` (24),
`ALAVANCAGEM` (36) e `FINANCIAMENTO_ESTOQUE` (18); `CONSOLIDACAO_DIVIDAS` é aceito na simulação (24 meses), mas não
aparece nas ofertas. O limite já desconta o que foi aprovado no mesmo produto. Taxas em percentual (`2.0900` =
2,09% a.m.).

`POST /me/credit/simulations` com `{"produto": "ANTECIPACAO_RECEBIVEIS", "valor": 42000, "prazo_meses": 3,
"receivable_ids": [901, 902]}` → 201:

```json
{
  "id": 77,
  "produto": "ANTECIPACAO_RECEBIVEIS",
  "valor_solicitado": 42000.0,
  "valor_liquido": 41702.15,
  "taxa_mensal": 2.09,
  "cet_anual": 29.41,
  "iof": 297.85,
  "parcelas": [
    { "n": 1, "vencimento": "2026-12-03", "amortizacao": 13708.5, "juros": 877.8, "valor": 14586.3 }
  ],
  "total_pago": 43758.9,
  "aprovacao": "PRE_APROVADO",
  "limite_disponivel": 96320.0,
  "validade": "2026-11-10"
}
```

`aprovacao`: `PRE_APROVADO|ANALISE|NEGADO`. `POST /me/credit/requests` com `{"simulation_id": 77}` ou
`{"produto", "valor", "prazo_meses"}` → 201 com o `CreditResponse` da Etapa 4 (em **camelCase**):

```json
{
  "id": 15,
  "customerId": 42,
  "valorSolicitado": 42000.0,
  "prazoMeses": 3,
  "scoreSnapshot": 655.0,
  "status": "APROVADO",
  "motivo": "…",
  "valorAprovado": 42000.0,
  "taxaJuros": 0.0209,
  "criadoEm": "2026-11-03T19:40:00Z",
  "createdByNome": "Marina Souza"
}
```

> **Exceção de nomenclatura:** `POST/GET /me/credit/requests` e `POST /me/credit/requests/{id}/confirm` são as
> únicas rotas `/me` que respondem em **camelCase**. Elas devolvem o mesmo `CreditResponseDto` do `GET /credits`
> (backoffice), com `taxaJuros` em fração (`0.0209` = 2,09% a.m.). O resto do portal é snake_case. É intencional,
> para reaproveitar o fluxo de crédito da Etapa 4 sem duplicar campos; o front lê esse formato em
> `PortalCreditRequest` (`src/portal/types.ts`).

`status`: `APROVADO`, `REVISAO`, `NEGADO` ou `AGUARDANDO_CONTRATACAO` (quem só tem `pedir_credito`; sem decisão,
contrato nem `credit.decided` até alguém com `contratar_credito` chamar `/confirm`). Na antecipação aprovada, os
recebíveis usados passam a `ANTECIPADO`.

| Status | `error`                             | Quando                                               |
| ------ | ----------------------------------- | ---------------------------------------------------- |
| 404    | `SIMULACAO_NAO_ENCONTRADA`          | `simulation_id` inexistente ou de outra empresa      |
| 422    | `SIMULACAO_JA_UTILIZADA`            | A simulação já virou um pedido                       |
| 422    | `SIMULACAO_EXPIRADA`                | Simulação com mais de 7 dias                         |
| 404    | `RECEBIVEL_NAO_ENCONTRADO`          | `receivable_ids` de outra empresa ou inexistente     |
| 422    | `RECEBIVEL_INDISPONIVEL`            | Recebível já recebido ou antecipado                  |
| 404    | `PEDIDO_NAO_ENCONTRADO`             | `/confirm` de pedido inexistente ou de outra empresa |
| 422    | `PEDIDO_NAO_AGUARDANDO_CONTRATACAO` | `/confirm` de pedido que não está aguardando         |
| 400    | `validation_failed`                 | Prazo acima do máximo do produto, corpo incompleto   |

Os erros 404/422/400 do crédito vêm como `{"error": "<código>", "message": "..."}`.
