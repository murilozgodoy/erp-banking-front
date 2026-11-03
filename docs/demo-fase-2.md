# Roteiro de demonstração — Fase 2 (Portal do Cliente ErpIa)

Apresentação ao vivo de **~18 minutos** do portal do cliente em produção. Contexto técnico em
[portal-cliente.md](portal-cliente.md) e rotas em [apis-fase-2.md](apis-fase-2.md). Tom e formato seguem o
[roteiro da Etapa 4](demo-etapa-4.md).

## A história

> A padaria **Aurora Pães**, de Campinas, usa a ErpIa como ERP e conta PJ. Hoje o caixa está bem, mas a ErpIa já
> enxerga que ele fica negativo no fim de novembro e mostra o crédito que cobre esse vale. A dona antecipa
> recebíveis, paga um boleto atrasado, pergunta à IA o que fazer, chama uma pessoa do financeiro com limite de
> pagamento e aprova o que passa do limite. No fim, duas empresas novas se cadastram ao vivo: uma é aprovada pela
> IA em segundos e a outra vai para um analista. O Grafana mostra tudo isso acontecendo.

| #   | Passo                                  | Tempo      |
| --- | -------------------------------------- | ---------- |
| 1   | Landing → login                        | 1 min      |
| 2   | Visão geral                            | 2½ min     |
| 3   | Recebíveis → simular antecipação       | 2 min      |
| 4   | Pagamentos → pagar boleto atrasado     | 1½ min     |
| 5   | Assistente ErpIa (3 perguntas)         | 3 min      |
| 6   | Equipe: convite, limite e aprovação    | 3 min      |
| 7   | Onboarding ao vivo (aprovado e manual) | 3½ min     |
| 8   | Grafana: dashboard do portal           | 1½ min     |
|     | **Total**                              | **18 min** |

## URLs e contas

| O quê                | Onde                                                         | Observação                              |
| -------------------- | ------------------------------------------------------------ | --------------------------------------- |
| Front (Vercel)       | <https://erp-banking-front.vercel.app>                       | login Auth0                             |
| API Gateway (EC2)    | <http://3.235.6.136:8080/gateway/health>                     | público                                 |
| Grafana (EC2)        | <http://3.235.6.136:8081/d/erp-portal>                       | dashboard **ErpIa — Portal do cliente** |
| Prometheus (EC2)     | porta 8082 (fechada no Security Group)                       | use Grafana → **Explore** ou túnel SSH  |
| Swagger Transactions | <http://3.235.6.136:8080/transactions/swagger-ui/index.html> | Plano B do passo 6 (ver lá)             |

| Conta                        | Quem é                                                  | Janela                                   |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| **A** `deployunas@gmail.com` | DONO da Aurora Pães                                     | navegador principal (janela normal)      |
| **B** (convidado)            | conta Auth0 **sem empresa**, vira FINANCEIRO no passo 6 | janela anônima do navegador principal    |
| **C** (empresa nova)         | conta Auth0 **sem empresa**, faz o onboarding aprovado  | 2º navegador, janela privada             |
| **D** (segmento "outro")     | conta Auth0 **sem empresa**, vai para a análise manual  | 2º navegador, janela privada (após C)    |
| **Admin**                    | perfil `admin` (ou `analista`) com `review:onboarding`  | 2º navegador, janela normal, `/analises` |

Senhas: com o grupo, **nunca** em slide, chat ou documento. Cada login pertence a **uma** empresa só: B, C e D
precisam ser contas que nunca entraram em empresa nenhuma (senão o convite dá "Esta conta já pertence a outra
empresa").

## Checklist — 1 hora antes

### Dados e back-end

- [ ] **Resetar a Aurora** (Git Bash, no `erp-banking-infra`). A URI do banco vai só na variável, nunca impressa;
      como montá-la está no `scripts/seed-aurora/README.md`. **Sempre com `--sub`**, senão o login do DONO fica
      desvinculado e cai no onboarding:

  ```bash
  cd erp-banking-infra/scripts/seed-aurora
  export DATABASE_URI='...'   # ver README.md da pasta; não cole em lugar nenhum
  ./aplicar.sh --sub '<user_id do DONO no Auth0>'
  ```

  O script regenera o `aurora.sql` com a data de hoje (os números e o vale andam com o dia) e apaga, antes de
  recriar, tudo da Aurora: pagamentos, propostas e **os membros da equipe** (o DONO é recriado sozinho pelo
  Onboarding). Os serviços guardam o `GET /me` em cache: espere uns minutos antes do login de aquecimento.

- [ ] **Health** do gateway e dos 3 serviços (sem token, o smoke só faz health):

  ```bash
  curl -s http://3.235.6.136:8080/gateway/health          # {"status":"UP"}
  cd erp-banking-infra && BASE_URL=http://3.235.6.136:8080 ./scripts/smoke.sh
  ```

  No Windows: `.\scripts\smoke.ps1 -BaseUrl http://3.235.6.136:8080`. **Não** rode o `smoke-portal.sh` com o
  token do DONO depois do reset: ele faz um PIX de R$ 10 e muda o saldo da Aurora.

- [ ] **Chave do LLM definida**, sem mostrar o valor (SSH na EC2, na pasta do `erp-banking-infra`; o padrão do
      `deploy-ec2.sh` é `~/erp-banking/erp-banking-infra`):

  ```bash
  docker compose exec credit-score-api sh -c 'test -n "$ANTHROPIC_API_KEY" && echo definida || echo VAZIA'
  ```

- [ ] **E2E do assistente** com o token do DONO (copie do DevTools → Network → cabeçalho `Authorization` de
      uma chamada `/api/...`; o token não aparece na tela do portal). Não use `APAGAR_TUDO=1` aqui:

  ```bash
  ACCESS_TOKEN='<token do DONO>' BASE_URL=http://3.235.6.136:8080 python3 scripts/assistant_e2e.py
  ```

  Sai com 0 e `PASS` no contrato; `WARN` de número não citado é aceitável (o texto do LLM varia). Um 503 aqui
  significa chave ausente.

- [ ] **Equipe no ar:** a página `/app/equipe` precisa mostrar o botão **Convidar pessoa** (veio no PR #72 do
      front; sem ele no deploy, o passo 6 vira só fala + Plano B).

### Navegador e contas

- [ ] **Login de aquecimento** com a conta A: a Visão geral precisa mostrar **R$ 31.870,45**, **15** pendências e
      o score **742**. Deixe essa aba em `/`.
- [ ] **Abas abertas:**
  - navegador principal, janela normal: front logado como A;
  - navegador principal, janela anônima: <https://erp-banking-front.vercel.app> (conta B, ainda sem login);
  - 2º navegador, janela normal: `/analises` logado como **admin**;
  - 2º navegador, janela privada: a landing (contas C e D);
  - Grafana no dashboard **ErpIa — Portal do cliente**, intervalo dos últimos 30 minutos.
- [ ] **Conta B** criada no Auth0 e **nunca** usada no portal. Anote nome e e-mail para o convite.
- [ ] **Contas C e D** criadas. Para caber no tempo, adiante o rascunho dos dois cadastros: entre, preencha os
      passos 1 a 3 do wizard (o autosave guarda) e **pare antes de enviar**. Tenha dois CNPJs válidos e inéditos.
  - C: segmento comum (ex.: tecnologia ou varejo) com números saudáveis (faturamento bom, dívida baixa,
    margem positiva), para sair `APROVADO` sem revisão. Ensaie com as mesmas respostas.
  - D: segmento **outro** (sempre vai para `ANALISE_MANUAL`, motivo `SEGMENTO_OUTRO`).
- [ ] **Ensaio do assistente:** faça as 3 perguntas do passo 5 uma vez. A conversa fica salva em **Conversas** e
      serve de Plano B. Tire print das 3 respostas.
- [ ] **Prints de segurança** de cada passo (Visão geral, simulação, comprovante, convite, status aprovado, fila,
      Grafana) numa pasta local.
- [ ] **Tela:** zoom 110–125%, tema escolhido no rail (**Tema escuro** / **Tema claro**) e mantido até o fim,
      notificações do sistema e do navegador desligadas, barra de favoritos escondida.
- [ ] **Rede:** hotspot do celular pronto. Front local em modo mock instalado e testado (ver "Plano B geral").

## Roteiro

### 1. Landing → login (1 min)

**Clicar:** <https://erp-banking-front.vercel.app> (janela anônima nova ou deslogada) → rolar o hero → **Entrar** →
login como A → volta ao `/` e o portal abre em `/app`.

**Falar:**

- "O ERP que lê sua operação e encontra o crédito certo": ERP, conta PJ e crédito no mesmo lugar.
- Login Auth0 (Authorization Code + PKCE). O token diz **quem** é; o que a pessoa pode fazer **na empresa** vem
  do nosso banco (passo 6).

**Tem que aparecer:** título "O ERP que lê sua operação e encontra o crédito certo.", botões **Criar conta
grátis** e **Entrar**; depois do login, o rail com **Aurora Pães** e Ag./CC.

**Plano B:** Auth0 fora → use a aba já logada do checklist. Sem rede → modo mock local (ver "Plano B geral").

### 2. Visão geral (2½ min)

**Clicar:** `/app` (item **Visão geral**). Passe o mouse no gráfico no vale. Clique em **Ler análise completa**
no card da Leitura.

**Falar:**

- Num relance: saldo, receita, prazo de recebimento e ciclo de caixa contra o segmento.
- O **caixa projetado de 60 dias** soma saldo, recebíveis e vendas previstas e tira as contas: a ErpIa vê o
  vale **antes** de ele acontecer.
- A **Leitura da ErpIa** e a oferta vêm da análise do negócio (regras + Claude) gravada quando a empresa foi
  aprovada; a Faísca lima marca tudo o que é inferido pela IA. (No passo 7 a análise é gerada ao vivo.)

**Tem que aparecer:**

- Cabeçalho "Bom dia/Boa tarde/Boa noite, Aurora Pães" e o botão **15 pendências para resolver**.
- Indicadores: **Receita 30 dias R$ 181.999,97**.
- Card **Leitura da ErpIa** (enquanto carrega: esqueleto "Carregando a leitura da ErpIa"), com "Ponto forte" e
  "Atenção", o bloco **Oportunidade de crédito** com o selo **Pré-aprovado**, a linha "Antecipação de
  recebíveis · … a.m. · até … meses" e o botão **Simular**. Rodapé "Atualizada em … · regras + IA".
- Painel **Caixa projetado — 60 dias**: **Saldo hoje R$ 31.870,45**; **Menor saldo do período −R$ 38.324,50
  em 25 nov**; faixa vermelha do vale no gráfico; embaixo, **Vale de caixa de 20 a 29 nov** ("O saldo fica
  negativo a partir de 20 nov e chega a −R$ 38.324,50").
- **Score e saúde do negócio**: **742 de 1.000**, selo **Risco médio**, "Análise por IA + regras", e a tabela
  de indicadores contra o segmento.

**Plano B:** card em "Analisando o seu negócio" → **Atualizar análise**. Erro "Não conseguimos carregar a visão
geral" → **Tentar de novo**; se persistir, prints.

### 3. Recebíveis → simular antecipação (2 min)

**Clicar:** **Recebíveis** (`/app/recebiveis`) → no gráfico **Valor líquido a receber por semana**, clique na
barra de uma semana próxima (a tabela filtra por ela) → marque 3 a 5 recebíveis na caixa de seleção da linha (o
botão **Selecionar recebíveis** do insight marca todos os previstos) → na barra que sobe, **Simular
antecipação** → no painel, troque o **Prazo em meses** (ex.: 2x) → **Ver cronograma** → **Cancelar** (ou
**Contratar**, se sobrar tempo: o reset desfaz).

**Falar:**

- Antecipa até **80%** do líquido dos recebíveis escolhidos; o caixa cobre o vale sem esperar o vencimento.
- Preço explicável: taxa base da faixa MEDIO (2,49% a.m.) com −0,4 pp para antecipação, parcelas Price, IOF e
  CET anual na tela.
- Técnico: `POST /me/credit/simulations` no Transactions (só calcula, vale 7 dias); contratar usa o fluxo de
  crédito da Etapa 4 e publica `credit.decided`.

**Tem que aparecer:** barra "N recebíveis · R$ … líquido"; painel **Simular antecipação** com **Valor a
antecipar** (já no máximo de 80%), **Prazo em meses** 1x a 6x, selo **Pré-aprovado** e **Valor líquido na
conta**.

**Plano B:** "Não conseguimos simular" → **Tentar de novo** com menos recebíveis; senão mostre o simulador em
**Crédito** (`/app/credito`) pelo botão **Simular** da Visão geral, ou o print.

### 4. Pagamentos → pagar um boleto atrasado (1½ min)

**Clicar:** **Pagamentos** (`/app/pagamentos`) → painel **Contas a pagar**, filtro **Atrasadas 3** → numa linha
com "· boleto", **Pagar** → conferir forma **Boleto** e **Linha digitável** → **Revisar pagamento** →
**Confirmar pagamento** → **Concluir**.

**Falar:**

- Banking embutido: o boleto sai da conta PJ sem trocar de sistema, e a conta a pagar do ERP baixa sozinha.
- O débito trava a conta (`SELECT FOR UPDATE`) e publica `transaction.created`; saldo insuficiente oferece
  capital de giro na hora.

**Tem que aparecer:** faixa com **Saldo disponível R$ 31.870,45** e **Atrasado R$ 17.373,00** (3 contas · juros
correndo); confirmação **Pagamento efetivado** com "Saldo após o pagamento: R$ …" e o comprovante com
autenticação; a conta passa para **Pagas** e o **Histórico de pagamentos** mostra **Efetivado**.

**Plano B:** erro no pagamento → mostre o fluxo até **Revisar pagamento** (que não debita nada) e o print do
comprovante.

### 5. Assistente ErpIa (3 min)

**Clicar:** **Perguntar à ErpIa** no rail (ou `Ctrl K` / `⌘K`). O painel abre com "Olá. O que vamos olhar hoje?"
e as sugestões **A partir desta tela**. Enquanto pensa, mostra "Lendo seus dados…" e as etapas da leitura.

| Onde              | Pergunta (chip ou digitada)                                                 | O que esperar                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/app`            | chip **Vale de caixa**: "Quando meu caixa fica negativo, e por quê?"        | Cita o vale a partir de 20/11 e o mínimo perto de −R$ 38,3 mil, com a causa (contas do fim do mês: compras de Natal e 13º). Chips em **Baseado em:** (visão geral / pagamentos) e um botão de ação para simular a antecipação. |
| `/app/recebiveis` | chip **Quanto antecipar**: "Quanto consigo antecipar sem apertar dezembro?" | Usa os recebíveis e chama a simulação ("Simulando as condições"): valor sugerido, taxa e parcelas. Fonte recebíveis/crédito e ação que abre `/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=…`.                             |
| `/app/pagamentos` | digitada: "Paga agora as contas atrasadas pra mim."                         | **Recusa executar** (o assistente nunca paga, contrata nem grava), lista as atrasadas (R$ 17.373,00 antes do passo 4) e aponta a tela de Pagamentos num botão.                                                                 |

**Falar:**

- A IA responde com os **números reais** da empresa: Claude com **tool use** chama 9 ferramentas só de leitura
  e simulação no Transactions, com o token do próprio cliente.
- Segurança: no máximo 6 ferramentas e 45 s por resposta, 10 mensagens/min, permissão `usar_assistente`,
  conteúdo do usuário tratado como dado (anti prompt injection) e ações só para rotas `/app/...`.
- Histórico no banco: **Conversas** lista, retoma e apaga (LGPD).

**Plano B:** "O assistente está indisponível no momento…" (sem chave, 503) ou demora > 45 s → abra a conversa
do ensaio em **Conversas**; senão, os prints. "Você atingiu o limite de 10 perguntas por minuto…" (429) → espere
o tempo indicado no **Tentar de novo** e siga para o passo 6.

### 6. Equipe: convite, limite e aprovação (3 min)

**Clicar:**

1. Conta A: **Equipe** (`/app/equipe`) → **Convidar pessoa** → **Nome** e **E-mail** da conta B → **Papel**
   **Financeiro** (as **Permissões** seguem o preset) → **Limite de pagamento**: **Paga sem aprovação até** R$
   1.000,00 → **Criar convite** → **Copiar** o **Link do convite** → **Concluir**.
2. Janela anônima: colar o link (`/convite/…`) → "Você foi convidado para a equipe de uma empresa na ErpIa" →
   **Entrar** com a conta B → "Pronto, você entrou na equipe" → o portal da Aurora abre (sem o item **Equipe** no
   rail).
3. Ainda como B: **Pagamentos** → **Novo pagamento** → **PIX** → **Nome de quem recebe**, **Chave PIX**,
   **Valor** R$ 2.000,00 → **Revisar pagamento** → **Confirmar pagamento** → **Concluir**. No **Histórico de
   pagamentos**, o selo **Pendente de aprovação**; o saldo não mudou.
4. Volta para a conta A: **Pagamentos** → aprovar o pagamento pendente na bandeja de aprovação (seção 11 do
   contrato: "Aguardando aprovação"). O débito acontece e o histórico passa para **Efetivado**.

**Falar:**

- O dono convida sem e-mail: o link aparece uma vez só ("Guarde agora: o link não aparece de novo."), vale 7 dias
  e o banco guarda só o hash sha256 do token.
- Papéis e permissões ficam no **nosso banco** (`company_members`), não no Auth0; os 3 back-ends aplicam a partir
  do `GET /me`. Acima do limite, o pagamento nasce `PENDENTE_APROVACAO` sem debitar, e o próprio autor não
  aprova (403 `AUTOR`).
- Cada mudança na equipe grava `company.member_changed` no **outbox transacional** na mesma transação; o relay
  republica se o RabbitMQ cair.

**Tem que aparecer:** convite **Convite criado** ("… pode entrar como Financeiro"); a linha de B na tabela
**Pessoas** com convite pendente; o selo **Pendente de aprovação** no histórico; depois da aprovação, **Efetivado**
e o saldo R$ 2.000,00 menor.

> **Atenção (conferir no ensaio):** no código do front revisado para este roteiro, a bandeja "Aguardando
> aprovação" ainda não existe, e a confirmação do painel de pagamento pode mostrar "Pagamento efetivado" mesmo
> quando o back devolve `PENDENTE_APROVACAO`. Mostre o selo no **Histórico de pagamentos** e o saldo inalterado.

**Plano B:**

- Sem bandeja: aprovar pela API com o token da conta A, no Swagger do Transactions (**Authorize**):
  `GET /me/payments/pending` → `POST /me/payments/{id}/approve`. Recarregue Pagamentos e mostre **Efetivado**.
- "Esta conta já pertence a outra empresa" → a conta B já tem empresa: **Entrar com outra conta** com uma conta
  limpa (ou só fale do fluxo e mostre o print).
- "Este convite expirou" / "Convite não encontrado" → gere outro convite.
- Auth0 fora → mostre o convite criado e o link, e pule para o passo 7.

### 7. Onboarding ao vivo: aprovado pela IA e análise manual (3½ min)

**Clicar (conta C, 2º navegador, janela privada):** landing → **Entrar** → cai em **Cadastro da empresa**
(`/app/onboarding`, rascunho já salvo) → passar rápido por **Dados da empresa**, **Segmento do negócio**, **Como
o negócio funciona** e **Observações e revisão** com **Continuar** → **Enviar para análise** → `/app/status`.

**Tem que aparecer:** **Análise do cadastro** ("Esta página se atualiza sozinha.") com "Análise automática em
andamento." e as etapas **Cadastro recebido**, **Análise automática** ("Regras e IA leem faturamento, prazos,
dívidas e observações") e **Decisão**; em ~10 s, **Cadastro aprovado** → **Abrir o portal** → Visão geral da
empresa nova com a Leitura e o rodapé "regras + IA". Se a Visão geral disser "Seu cadastro ainda está em análise"
por alguns segundos, é o seeder do Transactions abrindo a conta: aguarde ou clique **Acompanhar a análise**.

**Clicar (conta D, mesma janela privada após **Sair**):** **Entrar** com D → **Enviar para análise** (segmento
outro) → status "Cadastro encaminhado para um analista." com **Revisão por um analista** e a **Prévia da
análise**. No 2º navegador (admin): **Fila de análise** (`/analises`), filtro **Aguardando decisão** → abrir a
empresa → **Por que veio para a fila** (segmento outro) → **Aprovar** → **Comentário (opcional)** → **Confirmar
aprovação**. De volta à janela de D: a página passa sozinha para **Cadastro aprovado**.

**Falar:**

- Do cadastro ao crédito em minutos: wizard de 4 passos com autosave e perguntas do template do segmento.
- Assíncrono por eventos: o envio grava `customer.onboarding_submitted` no outbox; o Score roda regras + Claude
  (structured outputs, timeout de 20 s) e publica `business.analysis_completed`; o Transactions abre a conta PJ e
  gera os dados ao mesmo tempo.
- Regra de negócio, não só IA: segmento outro, baixa confiança do LLM ou regra crítica mandam para o analista,
  com o motivo na tela. A decisão usa compare-and-set (dois analistas ao mesmo tempo → 409).

**Plano B:**

- LLM fora ou lento: a análise sai **só por regras** depois do timeout (`gerado_por: regras`); a tela mostra
  "regras" no rodapé da Leitura e "Análise por regras" no score, e na fila a coluna **Gerado por**. Use isso
  como argumento de resiliência.
- C caiu em análise manual (resposta "arriscada") → aprove na fila como no caso D e siga.
- Status parado em "Análise automática em andamento." por mais de 30 s → mostre o print do aprovado e siga para o
  Grafana (o painel da fila conta a história).
- Auth0 fora → prints do wizard, do status aprovado e da fila.

### 8. Grafana: dashboard do portal (1½ min)

**Clicar:** <http://3.235.6.136:8081/d/erp-portal> (**ErpIa — Portal do cliente**), últimos 30 minutos.

| Linha                   | Apontar                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Funil de onboarding** | **Onboardings enviados** (+2 do passo 7), **Envios por segmento**, **Fila de análise manual** (subiu e voltou a 0), **Revisões por decisão**, **Taxa de aprovação automática** |
| **Análise por IA**      | **Análises por gerado_por** (`llm+regras` × `regras`), **Requisições ao LLM por resultado**, **Latência do LLM (p50 / p95)** (os ~10 s), **Erro + timeout do LLM**             |
| **Assistente**          | **Mensagens ao assistente**, **Chamadas de ferramenta por tool** (quais tools a IA usou no passo 5), **Latência do assistente (p50 / p95)**, **Tokens no período**             |
| **Equipe e outbox**     | **Membros ativos** e **Convites pendentes** (o convite do passo 6), **Mudanças na equipe (por min)**, **Outbox pendente** em 0 (tudo publicado)                                |

**Falar:** métricas de negócio e de IA lado a lado: quanto a IA aprova sozinha, quanto custa (tokens), quanto
demora e se o outbox está em dia. As linhas **Banking** e **Crédito no portal** mostram o pagamento e a simulação
dos passos 3, 4 e 6.

**Plano B:** painéis vazios → confira o intervalo de tempo; Grafana fora → prints, ou Grafana → **Explore** com
`sum by (gerado_por) (business_analyses_total)`.

## Plano B geral: front local em modo mock

Sem rede, Vercel ou EC2: rode o front local com os mocks MSW e o login simulado (só no `npm run dev`; nunca vai
para o build de produção). No `.env`:

```bash
VITE_USE_MOCKS=true
VITE_MOCK_AUTH=true
```

`npm run dev` → <http://localhost:5173/app?perfil=cliente>. Os mocks têm os mesmos números da carga (saldo R$
31.870,45, 15 pendências, score 742); o vale do mock é de 21 a 29/11 com mínimo de −R$ 37.756,90. Cenários do
onboarding com `?mock=nao_iniciado`, `?mock=em_analise`, `?mock=aprovado` etc., e a fila do backoffice com
`?perfil=admin`. Os mocks só cobrem o portal: o backoffice e o Grafana continuam precisando da EC2.

## Se der errado

| Sintoma                                                                          | Ação                                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| "Não foi possível entrar" no login                                               | Conferir no Auth0 as URLs da Vercel (callback, logout, web origins); usar a aba já logada; modo mock local                     |
| A conta A cai em **Cadastro da empresa** ou "Seu cadastro ainda está em análise" | Reset sem `--sub`: `./vincular-login.sh '<user_id do DONO>'` e esperar o cache do `GET /me` (até alguns minutos)               |
| Números diferentes dos esperados                                                 | A carga é de outro dia ou alguém mexeu: rodar `./aplicar.sh --sub '<user_id do DONO>'` de novo                                 |
| Leitura em "Analisando o seu negócio"                                            | **Atualizar análise**; persistindo, prints                                                                                     |
| "O assistente está indisponível no momento…"                                     | Chave do LLM ausente (503): conversa salva em **Conversas** ou prints; seguir                                                  |
| "Você atingiu o limite de 10 perguntas por minuto…"                              | Esperar o tempo do `Retry-After` (o botão **Tentar de novo** conta os segundos); seguir para o próximo passo                   |
| Convite: "Esta conta já pertence a outra empresa"                                | Usar uma conta Auth0 limpa (**Entrar com outra conta**)                                                                        |
| Pagamento de B saiu **Efetivado** (sem aprovação)                                | O limite não pegou: conferir na **Equipe** "Paga sem aprovação até" R$ 1.000 e pagar valor acima; permissões valem em até 60 s |
| Aprovação devolve 403                                                            | Quem pagou não aprova o próprio: aprovar com a conta A                                                                         |
| Status parado em "Análise automática em andamento."                              | Esperar o timeout do LLM (20 s; cai para regras); ver as filas no dashboard **RabbitMQ** do Grafana                            |
| Empresa não aparece em **Aguardando decisão**                                    | Filtro **Em análise automática** (ainda rodando); conferir se o admin tem `review:onboarding`                                  |
| Gateway ou serviço fora                                                          | SSH na EC2 → `docker compose ps` / `docker compose up -d <serviço>` no `erp-banking-infra`                                     |
| Rede caiu                                                                        | Hotspot do celular; sem jeito, modo mock local + prints                                                                        |

## Reset depois da demo

1. **Dados da Aurora** (saldo, pagamentos, antecipação, convites e membros da equipe voltam ao estado da carga):

   ```bash
   cd erp-banking-infra/scripts/seed-aurora
   export DATABASE_URI='...'
   ./aplicar.sh --sub '<user_id do DONO no Auth0>'
   ```

2. **Membro convidado (conta B):** o reset acima já apaga os membros da Aurora (a conta B fica livre para outro
   convite). Sem reset, pela tela: **Equipe** → menu da linha → **Remover da equipe** (ou **Revogar convite**, se
   não foi aceito).
3. **Empresas de teste (contas C e D):** não há rota nem script documentado para apagar uma empresa criada pelo
   onboarding (o reset só mexe na Aurora). Elas ficam no banco; na próxima demo, use **contas Auth0 novas** e
   CNPJs inéditos.
4. **Conversas do assistente** (por usuário; o reset não apaga): no painel, **Conversas** → **Opções do
   histórico** → **Apagar todo o histórico** → **Apagar tudo**. Pela API, `DELETE /score/me/assistant/conversations`
   com o token do usuário, ou o `assistant_e2e.py` com `APAGAR_TUDO=1`. É soft delete: some na hora e é removida de
   vez em 30 dias.
