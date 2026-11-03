/**
 * Contratos do Portal do Cliente (PORTAL_CLIENTE.md, seções 3, 4 e 5). Os nomes seguem as APIs
 * (snake_case, em português) para que mocks e respostas reais sejam intercambiáveis.
 */

// ---------- Onboarding (seção 3) ----------

export type OnboardingStatus =
  'NAO_INICIADO' | 'RASCUNHO' | 'EM_ANALISE' | 'ANALISE_MANUAL' | 'APROVADO' | 'REPROVADO'

export type Segmento =
  | 'varejo'
  | 'alimentacao'
  | 'servicos'
  | 'saude'
  | 'tecnologia'
  | 'industria'
  | 'agro'
  | 'construcao'
  | 'outro'

export type TipoCampo =
  'currency' | 'percent' | 'number' | 'integer' | 'select' | 'multiselect' | 'boolean' | 'text'

export interface CampoTemplate {
  id: string
  label: string
  tipo: TipoCampo
  obrigatorio?: boolean
  opcoes?: string[]
  min?: number
  max?: number
  ajuda?: string
}

export interface SecaoTemplate {
  id: string
  titulo: string
  campos: CampoTemplate[]
}

export interface OnboardingTemplate {
  segmento: Segmento
  nome: string
  descricao: string
  icone: string
  secoes: SecaoTemplate[]
}

export interface Empresa {
  razao_social: string
  nome_fantasia: string
  /** 14 dígitos, sem máscara. */
  cnpj: string
  /** Pode voltar `null` no rascunho. */
  email: string | null
  telefone: string | null
  cidade: string
  /** UF, 2 letras. */
  estado: string
  fundacao_ano: number | null
  funcionarios: number | null
}

export type RespostaValor = number | string | boolean | string[] | null
export type Respostas = Record<string, RespostaValor>

export interface Me {
  customer_id: number | null
  onboarding_status: OnboardingStatus
  empresa: Empresa | null
}

export interface OnboardingDraft {
  empresa: Empresa | null
  segmento: Segmento | null
  respostas: Respostas
  observacoes: string
  onboarding_status: OnboardingStatus
  updated_at: string | null
  /** Decisão do analista (reprovado ou aprovado com comentário). */
  review_comment?: string | null
  reviewed_at?: string | null
}

export interface OnboardingPayload {
  empresa: Empresa
  segmento: Segmento | null
  respostas: Respostas
  observacoes: string
  enviar: boolean
}

/** Erro de um campo: `campo` é "empresa.<campo>", "segmento" ou o id do campo do template. */
export interface CampoErro {
  campo: string
  erro: string
}

/** 422 do `PUT /me/onboarding` com `enviar=true`. */
export interface OnboardingValidationError {
  detail: string
  campos: CampoErro[]
}

export interface ReviewItem {
  customer_id: number
  empresa: Empresa
  segmento: Segmento
  observacoes: string | null
  /** Só o resumo; a análise completa vem de `GET /scores/analyses/{id}`. */
  analise: AnaliseResumo | null
  comentario?: string | null
  submitted_at: string
}

export interface AnaliseResumo {
  score: number | null
  faixa_risco: FaixaRisco | null
  gerado_por: 'regras' | 'llm+regras' | null
  status: AnalysisStatus
}

export interface ReviewDecision {
  decisao: 'APROVADO' | 'REPROVADO'
  comentario: string
}

/** Resposta do `POST /onboarding/reviews/{id}/decision` (409 se já decidido). */
export interface ReviewDecisionResult {
  customer_id: number
  onboarding_status: OnboardingStatus
  decisao: 'APROVADO' | 'REPROVADO'
  comentario: string
  reviewer: string
  reviewed_at: string
}

/** Erros das rotas `/me` do Transactions. */
export interface ErpApiError {
  /** ONBOARDING_PENDENTE, SALDO_INSUFICIENTE, CONTA_JA_PAGA, SIMULACAO_EXPIRADA, validation_failed... */
  error: string
  status?: OnboardingStatus
  mensagem?: string
  message?: string
  faltam?: number
  /** `validation_failed`: mensagem por campo. */
  campos?: Record<string, string>
}

// ---------- Credit Score: análise do negócio (seção 4) ----------

export type FaixaRisco = 'BAIXO' | 'MEDIO' | 'ALTO' | 'MUITO_ALTO'

export type KpiId =
  | 'receita_mensal'
  | 'margem_bruta_pct'
  | 'ticket_medio'
  | 'prazo_medio_recebimento_dias'
  | 'prazo_medio_pagamento_dias'
  | 'ciclo_caixa_dias'
  | 'endividamento_sobre_receita'
  | 'comprometimento_parcelas_pct'
  | 'cobertura_estoque_dias'

export type KpiUnidade = 'BRL' | 'PCT' | 'DIAS' | 'X' | string

export interface Kpi {
  id: KpiId
  label: string
  valor: number
  unidade: KpiUnidade
  benchmark_segmento: number | null
  leitura: string
}

export type InsightArea =
  'geral' | 'vendas' | 'recebiveis' | 'pagamentos' | 'estoque' | 'pendencias' | 'credito'

export type InsightSeveridade = 'info' | 'atencao' | 'oportunidade'

export interface Insight {
  area: InsightArea
  titulo: string
  texto: string
  severidade: InsightSeveridade
}

export type TipoOportunidade =
  | 'ANTECIPACAO_RECEBIVEIS'
  | 'CAPITAL_DE_GIRO'
  | 'ALAVANCAGEM'
  | 'FINANCIAMENTO_ESTOQUE'
  | 'CONSOLIDACAO_DIVIDAS'

export interface Oportunidade {
  tipo: TipoOportunidade
  titulo: string
  descricao: string
  valor_maximo: number
  taxa_mensal: number
  prazo_max_meses: number
  racional: string
}

export type AnalysisStatus = 'APROVADO' | 'ANALISE_MANUAL' | 'EM_ANALISE' | 'REPROVADO'

export interface BusinessAnalysis {
  customer_id: number
  status: AnalysisStatus
  /** `null` enquanto a análise roda (EM_ANALISE), como score/faixa/resumo/gerado_por/atualizado_em. */
  score: number | null
  faixa_risco: FaixaRisco | null
  resumo: string | null
  gerado_por: 'regras' | 'llm+regras' | null
  atualizado_em: string | null
  kpis: Kpi[]
  insights: Insight[]
  oportunidades: Oportunidade[]
  pontos_fortes: string[]
  riscos: string[]
  /** Por que foi para a análise manual (quando foi). */
  motivos_revisao?: { codigo: string; descricao: string }[]
}

// ---------- Transactions: ERP + banking (seção 5) ----------

export type FormaPagamento = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'DINHEIRO'

export interface FluxoCaixaDia {
  data: string
  entradas: number
  saidas: number
  saldo_projetado: number
}

export interface Overview {
  saldo: number
  /** `null` enquanto o seeder não abriu a conta PJ. */
  conta: { id: number; agencia: string; numero: string } | null
  receita_30d: number
  /** `null` quando os 30 dias anteriores não tiveram receita. */
  receita_30d_variacao_pct: number | null
  ticket_medio_30d: number
  recebiveis_90d: number
  a_pagar_30d: number
  atrasados_total: number
  estoque_valor: number
  pendencias_count: number
  fluxo_caixa: FluxoCaixaDia[]
}

export type GroupBy = 'day' | 'week' | 'month'

export interface SalesReport {
  serie: { periodo: string; valor: number; quantidade: number }[]
  por_forma_pagamento: { forma: FormaPagamento; valor: number; pct: number }[]
  por_canal: { canal: string; valor: number; pct: number }[]
  top_produtos: { sku: string; nome: string; valor: number; quantidade: number }[]
  total: number
  ticket_medio: number
}

export type ReceivableStatus = 'PREVISTO' | 'RECEBIDO' | 'ANTECIPADO'

export interface Receivable {
  id: number
  vencimento: string
  valor_bruto: number
  valor_liquido: number
  adquirente: string
  status: ReceivableStatus
}

export interface ReceivablesReport {
  itens: Receivable[]
  total_previsto: number
  por_semana: { semana: string; valor: number }[]
}

export type PayableCategoria =
  'FORNECEDOR' | 'FOLHA' | 'IMPOSTO' | 'ALUGUEL' | 'SERVICOS' | 'EMPRESTIMO'
export type PayableStatus = 'ABERTO' | 'PAGO' | 'ATRASADO' | 'AGENDADO'

export interface Payable {
  id: number
  fornecedor: string
  categoria: PayableCategoria
  vencimento: string
  valor: number
  status: PayableStatus
  codigo_barras: string | null
  pago_em: string | null
}

export interface PayablesReport {
  itens: Payable[]
  total_aberto: number
  total_atrasado: number
  proximos_7d: number
}

export type TipoPagamento = 'PIX' | 'BOLETO' | 'TED'

export interface PaymentRequest {
  tipo: TipoPagamento
  valor: number
  destinatario: string
  descricao: string
  payable_id?: number
  /** `YYYY-MM-DD`; ausente = pagar agora. */
  agendado_para?: string
  codigo_barras?: string
}

export interface ContaOrigem {
  id: number
  agencia: string
  numero: string
}

export interface Comprovante {
  tipo: TipoPagamento
  valor: number
  destinatario: string
  descricao: string
  /** Instant ISO. */
  data_hora: string
  agendado_para?: string | null
  /** 8 grupos de 4 hex: XXXX-XXXX-… */
  autenticacao: string
  conta_origem: ContaOrigem
  codigo_barras?: string | null
}

export interface PaymentResponse {
  id: number
  status: 'EFETIVADO' | 'AGENDADO'
  autenticacao: string
  saldo_apos: number
  comprovante: Comprovante
}

export interface Payment {
  id: number
  tipo: TipoPagamento
  destinatario: string
  valor: number
  descricao: string
  payable_id: number | null
  agendado_para: string | null
  codigo_barras: string | null
  status: 'EFETIVADO' | 'AGENDADO' | 'CANCELADO'
  autenticacao: string
  criado_em: string
}

/** 422 do `POST /me/payments`. */
export interface SaldoInsuficienteError {
  error: 'SALDO_INSUFICIENTE'
  faltam: number
}

/** Extrato: array no topo, mais recente primeiro; `data` é um Instant ISO. */
export interface StatementEntry {
  id: number
  data: string
  descricao: string
  tipo: 'CREDIT' | 'DEBIT'
  valor: number
  saldo_apos: number
}

export interface InventoryItem {
  id: number
  sku: string
  nome: string
  quantidade: number
  minimo: number
  custo_unitario: number
  preco_venda: number
  giro_dias: number
  ultima_venda: string | null
  cobertura_dias: number
  abaixo_minimo: boolean
  parado: boolean
}

export interface InventoryReport {
  itens: InventoryItem[]
  valor_total: number
  valor_parado: number
  abaixo_minimo: number
  cobertura_media_dias: number
}

export type PendenciaTipo =
  | 'CONTA_ATRASADA'
  | 'VENCE_HOJE'
  | 'ESTOQUE_BAIXO'
  | 'ESTOQUE_PARADO'
  | 'SALDO_INSUFICIENTE'
  | 'PROPOSTA_CREDITO'

/** Mesmos nomes das `oportunidades` do Score (Transactions `CreditProduct`). */
export type ProdutoCredito =
  | 'ANTECIPACAO_RECEBIVEIS'
  | 'CAPITAL_DE_GIRO'
  | 'ALAVANCAGEM'
  | 'FINANCIAMENTO_ESTOQUE'
  | 'CONSOLIDACAO_DIVIDAS'

export interface Pendencia {
  /** Ex.: "payable-12", "saldo-insuficiente", "credit-request-3", "inventory-low-5". */
  id: string
  tipo: PendenciaTipo
  titulo: string
  descricao: string
  valor: number | null
  data: string
  acao: { label: string; rota: string; credito?: { produto: ProdutoCredito; valor: number } }
}

export interface SimulationRequest {
  produto: ProdutoCredito
  valor: number
  prazo_meses: number
  receivable_ids?: number[]
}

export interface Parcela {
  n: number
  vencimento: string
  amortizacao: number
  juros: number
  valor: number
}

/** Taxas em PERCENTUAL: `taxa_mensal` 2.49 = 2,49% a.m.; `cet_anual` idem. */
export interface Simulation {
  id: string
  produto: ProdutoCredito
  valor_solicitado: number
  valor_liquido: number
  taxa_mensal: number
  cet_anual: number
  iof: number
  parcelas: Parcela[]
  total_pago: number
  aprovacao: 'PRE_APROVADO' | 'ANALISE' | 'NEGADO'
  limite_disponivel: number
  validade: string
}

export interface CreditOffer {
  produto: ProdutoCredito
  limite: number
  taxa_mensal_a_partir: number
  prazo_max_meses: number
}

export type CreditRequestInput =
  { simulation_id: string } | { produto: ProdutoCredito; valor: number; prazo_meses: number }

/** `CreditResponseDto` do Transactions (camelCase, igual ao `GET /credits`). */
export interface PortalCreditRequest {
  id: number
  customerId: number
  valorSolicitado: number
  prazoMeses: number
  scoreSnapshot: number | null
  status: 'APROVADO' | 'REVISAO' | 'NEGADO'
  motivo: string | null
  valorAprovado: number | null
  /** FRAÇÃO ao mês (0.0249 = 2,49% a.m.), ao contrário das simulações (percentual). */
  taxaJuros: number | null
  criadoEm: string
}

/** 409 das rotas `/me` do Transactions enquanto o onboarding não está aprovado. */
export interface OnboardingPendenteError {
  error: 'ONBOARDING_PENDENTE'
  status: OnboardingStatus
}
