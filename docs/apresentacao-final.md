---
marp: true
theme: erpia
paginate: true
size: 16:9
title: ErpIa — ERP com banking e crédito inteligente
description: Apresentação final do projeto (Etapa 4 + Fase 2), Projeto de Software, Insper
footer: Etapa 4 + Fase 2 · Projeto de Software · Insper
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: '' -->

<img class="mark" src="img/final/erpia-mark.svg" alt="">

# <span class="marca">Erp<span class="ia-text"><span class="I">I</span>a</span></span> — ERP com banking e crédito inteligente

<p class="sub">O ERP que lê a operação da empresa e encontra o crédito certo. Entrega final: Etapa 4 (produção) e Fase 2 (portal do cliente).</p>

<p class="team"><strong>Murilo</strong> · <strong>Lucas</strong> · <strong>Gabriel</strong> · <strong>João Vivacqua</strong> · <strong>Vinicius</strong> · <strong>João Baungartner</strong></p>

<!--
Fala: Murilo (abertura, 20 s).
"Somos o grupo do ERP Banking e Crédito. Hoje mostramos a versão final: o que levamos para produção na Etapa 4 e o
produto que construímos em cima disso, a ErpIa, um ERP para pequenas empresas com conta PJ e crédito embutidos."

Arquivo-fonte (Marp). Exportar a partir da raiz do repo do front:
npx @marp-team/marp-cli@4.1.2 docs/apresentacao-final.md --theme docs/marp-erpia.css --html --allow-local-files --pdf
npx @marp-team/marp-cli@4.1.2 docs/apresentacao-final.md --theme docs/marp-erpia.css --html --allow-local-files --pptx
(CHROME_PATH apontando para o Chrome instalado.) Diagramas: docs/img/final/diagramas/*.mmd.
Duração-alvo: ~18 min de slides + ~8 min de demo.
-->

---

<!-- header: Murilo -->

## Quem fala o quê

<div class="cols c3 small">
<div>

**Murilo**
Problema, <span class="marca">Erp<span class="I">I</span>a</span>
<span class="faint">slides 3–4</span>

**Lucas**
Arquitetura e Etapa 4
<span class="faint">slides 5–7</span>

</div>
<div>

**Gabriel**
Jornada do cliente, demo
<span class="faint">slides 8–9, 18</span>

**João Vivacqua**
Portal e crédito integrado
<span class="faint">slides 10–11</span>

</div>
<div>

**Vinicius**
Assistente, equipe
<span class="faint">slides 12–14</span>

**João Baungartner**
Qualidade, segurança, padrões
<span class="faint">slides 15–17</span>

</div>
</div>

<p class="mt muted small">Próximos passos e perguntas: todos.</p>

<!--
Fala: Murilo. Só mostrar a divisão; não ler o slide.
-->

---

<!-- _class: dense -->

## O problema

<div class="cols wide-left">
<div>

A pequena empresa opera em **planilhas e três sistemas**: o ERP registra vendas e contas, o banco guarda o dinheiro e o crédito chega tarde, caro e sem contexto.

- O dono só descobre o **vale de caixa** quando o boleto vence.
- O banco não enxerga recebíveis, estoque nem sazonalidade, então o crédito vira **cheque especial**.
- Do lado do banco: cadastro, score, decisão de crédito e permissões precisam ser **auditáveis** e escalar.

</div>
<div class="panel">

### O que nos propusemos

Um único sistema que **registra a operação**, **movimenta o dinheiro** e **oferece o crédito certo no momento certo**, com regras explicáveis e IA só onde ela ajuda.

</div>
</div>

<!--
Fala: Murilo (1 min). Contextualizar as etapas: 1 microsserviços, 2 integração, 3 Auth0 + front,
4 produção. A Fase 2 transformou o backoffice do banco num produto para a empresa cliente.
-->

---

## A <span class="marca">Erp<span class="I">I</span>a</span>

<div class="cols wide-right center">
<div>

<div class="small">

**ERP + conta PJ + crédito** num portal só, com backoffice para o banco.

- Vendas, recebíveis, estoque e contas a pagar.
- PIX, boletos e extrato da conta PJ.
- Em cada tela, o **crédito que resolve** aquele problema.
- Assistente que responde com os números da empresa.

</div>

<div class="ia mt">
<h4>Faísca</h4>
<p>A estrela lima marca só o que a IA infere: insights, oportunidades e valores pré-aprovados.</p>
</div>

</div>
<div class="shot">

![Landing da ErpIa](img/final/landing-hero.png)

<p class="caption">Landing em produção: erp-banking-front.vercel.app</p>
</div>
</div>

<!--
Fala: Murilo (1 min). A promessa da marca: "o ERP que lê a sua operação e encontra o crédito certo".
Explicar a Faísca: é o código visual que separa o que é dado do que é inferência da IA.
-->

---

<!-- header: Lucas -->
<!-- _class: diagram -->

## Arquitetura final

<img class="d" src="img/final/diagramas/arquitetura-final.svg" style="width:100%;max-height:520px" alt="Arquitetura final">

<!--
Fala: Lucas (1 min 30 s). Percorrer uma requisição: navegador → Vercel (mesma origem, sem CORS nem mixed
content) → gateway nginx na EC2 → um dos 3 microsserviços (2 linguagens). O síncrono vai por HTTP com token
relay; o que não precisa de resposta imediata vai por evento no RabbitMQ. O banco saiu do container: agora é um
Postgres gerenciado na Aiven (PG 18, SSL), com schema por serviço. Claude entra só no Score: análise do cadastro
e assistente. Prometheus raspa tudo pela rede interna; Grafana na 8081.
-->

---

## Etapa 4 · gateway e eventos

<div class="cols">
<div>

### API Gateway nginx

- Porta pública única (**8080**): `/onboarding`, `/score`, `/transactions`.
- Rate limit **50 req/s** por cliente + teto por IP → **429** com `Retry-After`.
- `X-Request-ID` em todos os logs; serviço fora → **503** JSON.
- `/metrics` e `/actuator` fora da internet.

</div>
<div>

### Assíncrono · RabbitMQ

- Exchange `erp.events` (topic, durável), envelope com `event_id`.
- `customer.created` abre a conta; `credit.decided` chega ao Score.
- Fase 2: `onboarding_submitted`, `analysis_completed`, `onboarding_reviewed`.
- Consumidores **idempotentes**; publicar nunca derruba o HTTP.

</div>
</div>

<!--
Fala: Lucas (1 min 30 s). Gateway: segurança, controle de abuso e observabilidade num lugar só. Eventos:
desacoplamento temporal — o Score não precisa estar no ar para o crédito ser decidido, e o seeder do ERP
roda em paralelo à análise do cadastro, consumindo o mesmo evento.
-->

---

## Etapa 4 · em produção

<div class="kpis">
<div class="kpi"><span class="v">9/9</span><span class="l">containers saudáveis na EC2 3.235.6.136</span></div>
<div class="kpi"><span class="v">7/7</span><span class="l">alvos do Prometheus up</span></div>
<div class="kpi"><span class="v">6</span><span class="l">dashboards Grafana provisionados + Portal</span></div>
<div class="kpi"><span class="v">14</span><span class="l">alertas (10 da Etapa 4 + 4 do portal)</span></div>
</div>

<div class="cols c3 mt small">
<div>

**Deploy**
CI publica imagens no GHCR (`:latest` e `:sha`); EC2 com `docker compose`; front na **Vercel** com rewrites `/api/*`.

</div>
<div>

**Banco gerenciado**
**Aiven**, Postgres 18 com SSL. Pools de 2+1 conexões por serviço Python e 3 no Java, dentro do limite de 20.

</div>
<div>

**Observabilidade**
Métricas de negócio (decisões de crédito, análises, mensagens do assistente, tokens) e saúde em `/monitoramento`.

</div>
</div>

<!--
Fala: Lucas (1 min 30 s). Destacar a migração do banco para a Aiven: tiramos o Postgres da EC2 (2 vCPU / 1,9 GB) e
ajustamos os pools para caber em 20 conexões. O container local ficou como rollback. Dashboards versionados:
qualquer um sobe o stack e já tem tudo.
-->

---

<!-- header: Gabriel -->

## Jornada do cliente

<div class="cols wide-right center">
<div>

<div class="kpis k2">
<div class="kpi"><span class="v">~3<small> min</small></span><span class="l">do cadastro ao envio</span></div>
<div class="kpi"><span class="v">9</span><span class="l">segmentos com perguntas próprias</span></div>
</div>

- Auth0 signup; a Post-Login Action dá o perfil **cliente**.
- 4 passos: empresa, **segmento**, perguntas, revisão.
- 8 a 14 campos por segmento; **rascunho salvo** a cada passo.
- Observações livres sobre o negócio vão para a análise.

</div>
<div class="shot">

![Escolha do segmento](img/final/onboarding-segmento.png)

</div>
</div>

<!--
Fala: Gabriel (1 min 30 s). O onboarding é rápido de propósito: valores aproximados bastam, a análise usa ordens de
grandeza. Segmentos: varejo, alimentação, serviços, saúde, tecnologia, indústria, agro, construção e "outro".
-->

---

## Análise: regras + LLM

<img class="d" src="img/final/diagramas/jornada-cliente.svg" style="max-height:230px;display:block;margin:0 auto 24px" alt="Jornada">

<div class="cols c3 small">
<div class="panel">

### Regras, sempre

KPIs, score 0–1000, faixa de risco, insights e oportunidades com valor. Explicável e determinístico.

</div>
<div class="ia">

### LLM, quando ajuda

Claude lê dados e observações e devolve JSON: enquadramento, confiança, riscos. Timeout de 20 s; se falhar, ficam as regras.

</div>
<div class="panel">

### Fila manual

Segmento "outro", perfil específico, confiança < 0,6 ou regra crítica → analista decide em `/analises`.

</div>
</div>

<!--
Fala: Gabriel (1 min 30 s). A IA nunca aprova sozinha um caso fora do padrão: ela só pode mandar para revisão
humana. Em paralelo, o seeder do Transactions abre a conta PJ e gera 120 dias de ERP determinísticos para a
demo (2.980 vendas, 4.885 recebíveis, 55 contas a pagar no teste).
-->

---

<!-- header: João Vivacqua -->

## Portal · visão geral

<div class="cols wide-right center">
<div>

<h4>Aurora Pães, em produção</h4>

<div class="kpis k2">
<div class="kpi"><span class="v">R$ 31.870<small>,45</small></span><span class="l">saldo da conta PJ</span></div>
<div class="kpi"><span class="v">R$ 181.999<small>,97</small></span><span class="l">receita 30 dias</span></div>
<div class="kpi"><span class="v">742</span><span class="l">score · faixa MÉDIO</span></div>
<div class="kpi neg"><span class="v">−R$ 38.324<small>,50</small></span><span class="l">vale de caixa, 20 a 29/11</span></div>
</div>

<p class="mt small"><span class="faisca">Antecipação pré-aprovada</span> <span class="muted">cobre o vale · 15 pendências abertas</span></p>

</div>
<div class="shot">

![Visão geral](img/final/visao-geral.png)

<p class="caption">Captura com dados de demonstração (mocks); os números ao lado são os da produção.</p>
</div>
</div>

<!--
Fala: João Vivacqua (1 min 30 s). A visão geral responde "como está minha empresa e o que vem pela frente":
KPIs comparados ao segmento, caixa projetado de 60 dias e, ao lado, a leitura da ErpIa com a oportunidade de
crédito que resolve o vale. Tudo isso veio do onboarding + seeder + análise.
-->

---

## Crédito em cada tela

<div class="cols c3">
<div>
<div class="shot">

![Simulador de crédito](img/final/credito-simulador.png)

</div>
<p class="small mt"><strong>Crédito</strong> · simulador com parcelas Price, IOF e CET; limites por produto.</p>
</div>
<div>
<div class="shot">

![Recebíveis](img/final/recebiveis.png)

</div>
<p class="small mt"><strong>Recebíveis</strong> · agenda por adquirente; selecionar e antecipar.</p>
</div>
<div>
<div class="shot">

![Pagamentos](img/final/pagamentos.png)

</div>
<p class="small mt"><strong>Pagamentos</strong> · PIX, boleto e agendamento; pagar com capital de giro quando o saldo não cobre.</p>
</div>
</div>

<div class="ia mt xsmall" style="padding:12px 20px">
<p style="margin:0"><span class="faisca">Precificação explicável</span> — taxa base pela faixa (BAIXO 1,69% · MÉDIO 2,49% · ALTO 3,49% a.m.), ajuste por produto e limite pelo lastro: 80% dos recebíveis, 60% do estoque, 3× a receita.</p>
</div>

<!--
Fala: João Vivacqua (1 min 30 s). Vendas, estoque e pendências seguem o mesmo princípio: cada aba tem um insight
e uma ação de crédito ligada ao problema daquela aba. O banking é real: pagar gera um débito na conta,
com comprovante.
-->

---

<!-- header: Vinicius -->

## Assistente <span class="marca">Erp<span class="I">I</span>a</span>

<div class="cols wide-right center">
<div class="small">

<div class="ia">
<h4>Tool use seguro</h4>
<p>Claude chama só ferramentas de <strong>leitura e simulação</strong> do Transactions, com o token do próprio
usuário. Nunca paga nem contrata.</p>
</div>

- Até 6 chamadas de ferramenta por resposta; 10 mensagens/min.
- Responde com **fontes** e **ações** ("Simular antecipação").
- **Histórico no banco**: retomar, apagar uma ou todas (LGPD).
- **E2E aprovado** em produção com Claude real usando tools.

</div>
<div class="shot">

![Assistente respondendo](img/final/assistente-resposta.png)

<p class="caption">Ctrl+K abre o painel em qualquer tela do portal.</p>
</div>
</div>

<!--
Fala: Vinicius (1 min 30 s). O prompt trata o texto do usuário como dado (proteção contra injection) e só responde
sobre a empresa e os produtos da ErpIa. O conteúdo das ferramentas não é salvo, só a resposta e as fontes.
Métricas: assistant_messages_total, assistant_tool_calls_total, tokens.
-->

---

<!-- _class: diagram -->

## Assistente · uma pergunta por dentro

<img class="d" src="img/final/diagramas/assistente-tools.svg" style="max-height:470px" alt="Sequência do assistente">

<!--
Fala: Vinicius (45 s). Mostrar os dois limites de confiança: o Score valida permissão e limite antes de chamar o
modelo, e o Transactions valida ver_financeiro em cada ferramenta. O modelo nunca vê o token.
-->

---

## Equipe e permissões

<div class="cols">
<div>

O dono convida funcionários e decide **o que cada um pode fazer**. No Auth0 todos são `cliente`; as permissões finas ficam no nosso banco e o **back aplica**.

<p class="mt"><span class="tag">ver_financeiro</span><span class="tag">pagar</span><span class="tag">aprovar_pagamentos</span><span class="tag">pedir_credito</span><span class="tag">contratar_credito</span><span class="tag">gerenciar_estoque</span><span class="tag">gerenciar_equipe</span><span class="tag">usar_assistente</span></p>

</div>
<div>

| Papel      | Preset                                    |
| ---------- | ----------------------------------------- |
| DONO/ADMIN | todas                                     |
| FINANCEIRO | pagar, aprovar, pedir crédito, assistente |
| OPERADOR   | pagar até um limite, estoque              |
| LEITURA    | só ver o financeiro                       |

<p class="small mt"><strong>Aprovação de pagamentos:</strong> acima do limite o pagamento fica
<em>pendente</em>, sem debitar, até outra pessoa aprovar. Convite por link de uso único (hash, 7 dias).</p>

</div>
</div>

<!--
Fala: Vinicius (1 min). Regra dos quatro olhos: quem paga não aprova o próprio pagamento. Sem permissão, o botão
aparece desabilitado com o motivo, em vez de sumir. Auditoria: created_by e approved_by.
-->

---

<!-- header: João Baungartner -->

## Qualidade e carga

<div class="kpis">
<div class="kpi ok"><span class="v">97–99%</span><span class="l">cobertura nos 4 repos (CI falha abaixo de 80%)</span></div>
<div class="kpi"><span class="v">426<small> ms</small></span><span class="l">p95 do fluxo de negócio autenticado, 30 VUs</span></div>
<div class="kpi"><span class="v">0</span><span class="l">respostas 5xx em todos os cenários</span></div>
<div class="kpi"><span class="v">~280<small> req/s</small></span><span class="l">sustentados pelo gateway no stress</span></div>
</div>

<div class="cols mt small">
<div>

**CI em todo PR:** lint, format, typecheck, testes com cobertura, build Docker e publish no GHCR. Merge só com CI verde; Conventional Commits.

</div>
<div>

**k6 na EC2:** smoke, load, rate-limit, stress e spike (p95 < 12 ms) + fluxo de negócio com token real do Auth0 (cliente → score → conta → crédito). Os 429 são o rate limit funcionando: todo o tráfego sai de um IP.

</div>
</div>

<!--
Fala: João Baungartner (1 min 30 s). O business flow escreve no Postgres gerenciado e publica eventos; mesmo assim
p95 de 426 ms numa instância de 2 vCPU / 1,9 GB. Se perguntarem dos thresholds: só falham porque o k6 conta 429
como falha; com ALLOW_429 o p95 < 500 ms passou.
-->

---

<!-- _class: dense -->

## Segurança

<div class="cols c3 small">
<div class="panel">

### Identidade

Auth0 com RBAC: perfis de staff e **cliente**, Post-Login Action para signup self-service. Permissões no JWT, checadas em cada serviço.

</div>
<div class="panel">

### Entre serviços

**Token relay**: o JWT do usuário segue nas chamadas síncronas. Gateway como única porta, rate limit e métricas internas.

</div>
<div class="panel">

### Dados e eventos

**Outbox transacional** no Onboarding: evento gravado na mesma transação e republicado se o broker cair. Consumidores idempotentes.

</div>
<div class="ia">

### IA

Texto do usuário tratado como dado (proteção contra prompt injection), ferramentas só de leitura, sem tokens no histórico.

</div>
<div class="panel">

### Segredos

Fora do git: `.env` da EC2, variáveis da Vercel e do Auth0. A chave da Anthropic nunca vai para log nem resposta.

</div>
<div class="panel">

### Conexões

Postgres com SSL na Aiven; HTTPS na Vercel; headers de segurança; convites guardados só como hash.

</div>
</div>

<!--
Fala: João Baungartner (1 min 30 s). Escolher dois para aprofundar se o tempo apertar: token relay e outbox.
-->

---

<!-- _class: dense -->

## Padrões de projeto

| Padrão                                | Onde                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| **Strategy + Factory**                | Score: estratégias de score; `BusinessAnalyzer` com `RuleBasedAnalyzer` e `LlmAnalyzer` |
| **API Gateway**                       | nginx: ponto único de entrada, rate limit, request-id                                   |
| **Publish/Subscribe**                 | RabbitMQ `erp.events`, vários consumidores por evento                                   |
| **Transactional Outbox**              | Onboarding: `outbox_events` + relay com `FOR UPDATE SKIP LOCKED`                        |
| **Consumidor idempotente**            | `event_id` único; seeder e análise não refazem trabalho                                 |
| **Circuit Breaker + Retry**           | Transactions → Score (timeout, retry, 503 claro)                                        |
| **Token relay**                       | serviços e ferramentas do assistente repassam o JWT do usuário                          |
| **Repository · Database per service** | SQLAlchemy e Spring Data JPA; um schema por serviço                                     |

<!--
Fala: João Baungartner (1 min). Novidade da Fase 2: a mesma Strategy do score foi reaproveitada para a análise
do negócio, com o LLM como estratégia opcional (sem chave, só regras).
-->

---

<!-- header: Gabriel -->

## Demo · roteiro

<div class="steps">
<div><span class="n">1 · Landing e cadastro</span><h3>Criar conta</h3><p>Signup no Auth0, perfil cliente pela Action, onboarding de alimentação em ~3 min.</p></div>
<div><span class="n">2 · Análise</span><h3>Regras + IA</h3><p>Status com timeline; um caso "outro" cai na fila e o analista aprova em /analises.</p></div>
<div><span class="n">3 · Portal</span><h3>Aurora Pães</h3><p>Visão geral, vale de caixa, antecipação pré-aprovada, simulador e um PIX.</p></div>
</div>
<div class="steps mt">
<div><span class="n">4 · Assistente</span><h3>Ctrl+K</h3><p>"Qual crédito resolve o vale de novembro?" com ferramentas e fontes.</p></div>
<div><span class="n">5 · Equipe</span><h3>Convite</h3><p>Operador com limite: o pagamento acima dele fica pendente de aprovação.</p></div>
<div><span class="n">6 · Operação</span><h3>Grafana</h3><p>Dashboards Portal e k6, métricas de negócio e do assistente.</p></div>
</div>

<!--
Fala: Gabriel conduz a demo (~8 min); cada integrante assume o passo do seu tema:
1 Murilo, 2 Gabriel, 3 João Vivacqua, 4 Vinicius, 5 Vinicius/João Baungartner, 6 Lucas.
Plano B: se a rede falhar, mostrar as capturas destes slides e o vídeo local.
-->

---

<!-- header: Todos -->

## Próximos passos

<div class="cols">
<div>

### Plataforma

- **TLS no gateway** (domínio + Let's Encrypt) e fechar a porta HTTP.
- **DLQ** e retentativas com backoff nos consumidores.
- **M2M** (client credentials) entre serviços no lugar do token relay.
- Réplicas atrás do gateway; RabbitMQ gerenciado; tracing com OpenTelemetry.

</div>
<div>

### Produto

- Open Finance para importar extratos e recebíveis reais.
- Envio de convites e alertas por e-mail.
- Assistente com streaming e ações confirmadas pelo usuário.
- Contratação de crédito com assinatura e formalização.

</div>
</div>

<!--
Fala: todos (1 min). Cada um cita uma lição do seu pedaço em uma frase. Sugestões:
Murilo — contratos escritos antes (PORTAL_CLIENTE.md) deixaram 4 frentes em paralelo;
Lucas — mensageria opcional (no-op sem broker) simplificou dev e testes;
Gabriel — regras primeiro, LLM como complemento;
João Vivacqua — mocks com o contrato exato destravaram o front;
Vinicius — tool use só de leitura é o limite certo para um assistente financeiro;
João Baungartner — rate limit por IP atrapalha teste de carga de um cliente só.
-->

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: '' -->
<!-- header: '' -->

<img class="mark" src="img/final/erpia-mark.svg" alt="">

# Perguntas

<p class="sub">Front <strong>erp-banking-front.vercel.app</strong> · Gateway <strong>3.235.6.136:8080</strong> · Grafana <strong>3.235.6.136:8081</strong></p>

<p class="team">Código em github.com/murilozgodoy/erp-banking-* · documentação em erp-banking-front/docs/</p>

<!--
Fala: todos. Abrir para perguntas. Se sobrar tempo, voltar ao slide de arquitetura.
-->
