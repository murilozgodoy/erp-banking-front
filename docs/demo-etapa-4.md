# Roteiro de demonstração — Etapa 4

Apresentação de ~15 minutos do ERP Banking e Crédito rodando em produção: front na Vercel, back na EC2 atrás do
API Gateway, comunicação assíncrona pelo RabbitMQ e observabilidade com Prometheus e Grafana. Detalhes técnicos em
[etapa-4.md](etapa-4.md). Os slides que antecedem a demo estão em [apresentacao-etapa-4.md](apresentacao-etapa-4.md),
que também traz a divisão de quem fala o quê.

## URLs

| O quê                | URL                                                                             | Acesso                                                                                 |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Front (Vercel)       | <https://erp-banking-front.vercel.app>                                          | login Auth0                                                                            |
| API Gateway (EC2)    | <http://3.235.6.136:8080/gateway/health>                                        | público                                                                                |
| Grafana (EC2)        | <http://3.235.6.136:8081>                                                       | usuário `admin`; senha com o grupo (ver abaixo)                                        |
| Prometheus (EC2)     | Grafana → **Explore** (<http://3.235.6.136:8081/explore>) ou túnel SSH (abaixo) | 8082 bloqueada no Security Group                                                       |
| Swagger Transactions | <http://3.235.6.136:8080/transactions/swagger-ui/index.html>                    | público (os endpoints exigem token; Swagger das APIs Python exige token já para abrir) |

Prometheus acessível pelo **Grafana (Explore)** ou por túnel SSH (`ssh -i ~/.ssh/erp-ec2.pem -L 9090:localhost:8082 ubuntu@3.235.6.136` → <http://localhost:9090>); a 8082 pública depende de liberação no Security Group.

A senha do Grafana é o `GRAFANA_ADMIN_PASSWORD` do `.env` do `erp-banking-infra` na EC2 (não é versionada). O
RabbitMQ Management não é publicado (só rede interna do compose): mostre as filas pelo dashboard **RabbitMQ** do
Grafana ou, na EC2, com `docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers`.

## Antes de começar (checklist, 10 min antes)

- [ ] <http://3.235.6.136:8080/gateway/health> responde `{"status":"UP"}`.
- [ ] Túnel SSH do Prometheus aberto e <http://localhost:9090/targets> com os 7 jobs `UP` (`onboarding-api`, `credit-score-api`, `transactions-api`,
      `gateway`, `rabbitmq`, `rabbitmq-detailed`, `prometheus`).
- [ ] Usuários de teste no Auth0, um por perfil: **admin**, **analista** e **atendente** (senhas com o grupo).
- [ ] A URL da Vercel cadastrada no Auth0 (Allowed Callback / Logout / Web Origins) — sem isso o login falha.
- [ ] Abas abertas: front, Grafana (dashboard **Visão geral**), Prometheus pelo túnel (`http://localhost:9090/alerts`) e um terminal no
      `erp-banking-infra/load-tests`.
- [ ] Docker ligado na máquina que vai rodar o k6.

## Roteiro

### 1. Arquitetura (1 min) — Murilo

Já apresentada no slide 2; aqui, só apontar o diagrama de [etapa-4.md](etapa-4.md#arquitetura-final): navegador → Vercel (rewrite `/api/*`) → gateway
nginx na EC2 (`:8080`, única entrada) → 3 serviços na rede interna do compose → Postgres (3 schemas) e RabbitMQ
(`erp.events`). Prometheus coleta métricas dos serviços, do nginx e do RabbitMQ; Grafana exibe.

### 2. Login e perfis (2 min) — Lucas

1. Abrir <https://erp-banking-front.vercel.app> e entrar como **atendente**: menu sem **Monitoramento**; consegue
   cadastrar cliente e abrir conta, mas não calcular score nem pedir crédito.
2. Sair e entrar como **analista**: vê score e crédito, não cadastra cliente.
3. Sair e entrar como **admin** (resto da demo): todas as telas, incluindo **Monitoramento**.
4. Em **Meu perfil**, mostrar as permissões vindas do access token (RBAC do Auth0).

### 3. Monitoramento no front (1 min) — João Vivacqua

**Monitoramento**: os 3 serviços e o API Gateway **Online**, com latência, atualizados a cada 10 s. Os links abrem
Grafana, Prometheus e Swagger. Na home, os **indicadores** (clientes, contas, créditos por decisão).

### 4. Fluxo de negócio e eventos (5 min) — Gabriel

1. **Clientes → Novo cliente**: cadastrar com endereço e perfil financeiro (renda alta para aprovar).
   - Evento `customer.created` → o Transactions consome e **abre uma conta corrente automaticamente** (saldo
     zero). Na ficha do cliente, **espere ~3 s**: o card **Contas** recarrega sozinho (a cada 3 s enquanto vazio)
     e mostra a conta sem ninguém tê-la aberto.
2. Na ficha 360°, registrar a **anamnese** (dívidas baixas) e **calcular o score** (strategy `weighted`).
3. **Contas**: lançar um crédito (depósito) na conta → evento `transaction.created`.
4. Na ficha, **solicitar crédito** → a Transactions consulta o Score, decide (APROVADO/REVISAO/NEGADO) e publica
   `credit.decided`.
5. Em até ~5 s (o card faz polling), **"Decisões registradas via evento"** mostra a decisão que chegou ao Score pelo
   RabbitMQ (com `event_id`, `occurred_at` e `received_at`) — prova da comunicação assíncrona.
6. Alterar a anamnese (aumentar as dívidas) → evento `customer.anamnesis_updated` → **em ~5 s** (o status faz
   polling) aparece o aviso **"Score desatualizado — reavalie"**. Recalcular o score faz o aviso sumir.

### 5. Observabilidade (3 min) — João Vivacqua

1. Grafana → **Negócio**: clientes criados, transações por tipo, decisões de crédito por status, eventos
   publicados/consumidos — refletindo o passo 4.
2. **Visão geral**: UP/DOWN, req/s, p95 e 5xx por serviço, além do gateway (nginx) e dos eventos;
   **Serviços Python (onboarding / score)**: por handler; **Transactions API (JVM)**: memória, threads, GC e pool
   do banco; **RabbitMQ**: filas, consumidores e mensagens.
3. Prometheus (túnel, `http://localhost:9090/alerts`; ou Grafana → Explore para consultas): regras `ServiceDown`, `GatewayNginxDown`, `HighErrorRatePython/Java`,
   `HighLatencyP95Python/Java`, `RabbitMQQueueBacklog`, `RabbitMQBacklogTotal`, `EventPublishErrors` e
   `GatewayTrafficSpike`. Uma consulta rápida, ex.: `sum by (status) (credit_decisions_total)`.

### 6. Rate limit e carga (3 min) — Vinicius

1. Rate limit (50 req/s por cliente, burst 100; teto de 200 req/s por IP de conexão) no terminal:

   ```bash
   cd erp-banking-infra/load-tests
   BASE_URL=http://3.235.6.136:8080 AUTH_MODE=none ./run.sh rate-limit
   ```

   O relatório mostra respostas **429** `{"detail":"Too Many Requests"}` com `Retry-After`. Alternativa sem k6:

   ```bash
   seq 300 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
     http://3.235.6.136:8080/gateway/health | sort | uniq -c
   ```

   No front, um 429 vira a mensagem "Muitas requisições em sequência. Aguarde … e tente novamente." e as consultas
   são retentadas respeitando o `Retry-After`.

2. Testes de carga: os números já estão no slide 7 e em [resultados](etapa-4.md#testes-de-carga--resultados); mostrar o dashboard **k6**
   do Grafana (p95, req/s por status, VUs) de uma execução de `load`/`stress`/`spike`. Comentar o gargalo e o
   efeito do rate limit com todo o tráfego saindo de um IP só.

### 7. Qualidade e entrega (1 min) — João Baungartner

CI verde nos 5 repositórios (lint, testes com cobertura ≥ 80%, build, imagem Docker publicada no GHCR), deploy do
back via compose na EC2 e do front na Vercel. Documentação em `erp-banking-front/docs/`.

## Plano B

| Problema                     | O que fazer                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login na Vercel falha        | Front local (`npm run dev`, `.env` com `http://3.235.6.136:8080/<svc>`); exige `http://localhost:5173` no `CORS_ORIGINS` da EC2, e os 429/503 do gateway chegam sem CORS (aparecem como erro de rede) |
| Um serviço `Offline`         | `ssh` na EC2 → `docker compose ps` / `docker compose up -d <serviço>` no `erp-banking-infra`                                                                                                          |
| Decisão não aparece na ficha | O card atualiza a cada 5 s; se não vier, conferir a fila `credit-score.credit-decided` no Grafana                                                                                                     |
| EC2 fora do ar               | Stack local (`docker compose up -d` no infra) **e** front local (`npm run dev`, `.env` padrão `http://localhost:8080/<svc>`); a Vercel não alcança o localhost                                        |
