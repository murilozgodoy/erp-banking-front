import type {
  AnaliseResumo,
  BusinessAnalysis,
  CampoErro,
  CreditOffer,
  Empresa,
  FluxoCaixaDia,
  FormaPagamento,
  GroupBy,
  InventoryItem,
  InventoryReport,
  Me,
  OnboardingDraft,
  OnboardingPayload,
  OnboardingStatus,
  Overview,
  Payable,
  PayablesReport,
  Payment,
  PaymentRequest,
  PaymentResponse,
  Pendencia,
  PortalCreditRequest,
  ProdutoCredito,
  Receivable,
  ReceivablesReport,
  Respostas,
  ReviewDecision,
  ReviewDecisionResult,
  ReviewItem,
  SalesReport,
  Segmento,
  Simulation,
  SimulationRequest,
  StatementEntry,
} from '../types'
import {
  analiseNegocio,
  cnpjComDv,
  cnpjValido,
  faixaDoScore,
  filaInicial,
  mil,
  reais,
  type MetricasNegocio,
  type ReviewRegistro,
} from './analysis'
import { limiteProduto, PRAZO_MAX_MESES, r2, simular, TAXA_BASE, taxaMensal } from './pricing'
import {
  addDias,
  autenticacao,
  diasEntre,
  gerarContas,
  gerarEstoque,
  gerarExtrato,
  gerarPagamentos,
  gerarRecebiveis,
  gerarVendas,
  dataSp,
  hoje,
  inicioSemana,
  isoDate,
  linhaDigitavel,
  mulberry32,
  paraRecebiveis,
  parseIso,
  PRODUTOS,
  type VendaDia,
} from './seed'
import { camposDe } from './templates'
import * as team from './team'

// ---------- o cliente logado ----------

export const CUSTOMER_ID = 1042
export const RECEITA_BASE = 182_000
const SALDO_INICIAL = 31_870.45
const CONTA = { id: 7, agencia: '0001', numero: '048213-7' }
/** Segundos até a análise automática terminar depois do envio. */
export const ANALISE_MS = 8_000

export const EMPRESA_AURORA: Empresa = {
  razao_social: 'Padaria e Confeitaria Aurora Ltda',
  nome_fantasia: 'Aurora Pães',
  cnpj: cnpjComDv('459132680001'),
  email: 'financeiro@aurorapaes.com.br',
  telefone: '19987654321',
  cidade: 'Campinas',
  estado: 'SP',
  fundacao_ano: 2014,
  funcionarios: 23,
}

export const RESPOSTAS_AURORA: Respostas = {
  faturamento_mensal: RECEITA_BASE,
  ticket_medio: 32,
  pct_delivery: 28,
  canais_delivery: ['Balcão', 'iFood', 'WhatsApp', 'Encomendas'],
  sazonalidade: 'Alta',
  prazo_medio_recebimento_dias: 11,
  prazo_medio_pagamento_dias: 21,
  possui_estoque: true,
  valor_estoque: 48_000,
  pct_cartao_credito: 31,
  margem_bruta_pct: 58,
  folha_mensal: 38_500,
  dividas_total: 210_000,
  parcela_dividas_mensal: 9_800,
}

export const OBSERVACOES_AURORA =
  'Padaria de bairro no Cambuí, com encomendas para festas e cestas corporativas. Dezembro é o melhor mês, mas as compras de Natal e o 13º apertam o caixa no fim de novembro.'

// ---------- estado do onboarding (persistido) ----------

const STORAGE_KEY = 'erp-portal-mock'
const STATUSES: OnboardingStatus[] = [
  'NAO_INICIADO',
  'RASCUNHO',
  'EM_ANALISE',
  'ANALISE_MANUAL',
  'APROVADO',
  'REPROVADO',
]
const SEGMENTOS: Segmento[] = [
  'varejo',
  'alimentacao',
  'servicos',
  'saude',
  'tecnologia',
  'industria',
  'agro',
  'construcao',
  'outro',
]

interface OnboardingState {
  status: OnboardingStatus
  empresa: Empresa | null
  segmento: Segmento | null
  respostas: Respostas
  observacoes: string
  updatedAt: string | null
  submittedAt: string | null
  /** Comentário do analista na decisão manual (o real guarda em `business_profiles.review_comment`). */
  reviewComment?: string | null
}

/** Comentário de exemplo do cenário `?mock=reprovado`. */
export const COMENTARIO_REPROVACAO =
  'Não conseguimos confirmar o faturamento informado com o volume de vendas no cartão. Envie de novo com o faturamento dos últimos 3 meses.'

function cenario(status: OnboardingStatus): OnboardingState {
  const agora = new Date().toISOString()
  if (status === 'NAO_INICIADO') {
    return {
      status,
      empresa: null,
      segmento: null,
      respostas: {},
      observacoes: '',
      updatedAt: null,
      submittedAt: null,
    }
  }
  if (status === 'RASCUNHO') {
    return {
      status,
      empresa: { ...EMPRESA_AURORA },
      segmento: 'alimentacao',
      respostas: { faturamento_mensal: RECEITA_BASE, ticket_medio: 32, pct_delivery: 28 },
      observacoes: '',
      updatedAt: agora,
      submittedAt: null,
    }
  }
  const ontem = new Date(Date.now() - 86_400_000).toISOString()
  return {
    status,
    empresa: { ...EMPRESA_AURORA },
    segmento: 'alimentacao',
    respostas: { ...RESPOSTAS_AURORA },
    observacoes: OBSERVACOES_AURORA,
    updatedAt: status === 'EM_ANALISE' ? agora : ontem,
    submittedAt: status === 'EM_ANALISE' ? agora : ontem,
    reviewComment: status === 'REPROVADO' ? COMENTARIO_REPROVACAO : null,
  }
}

function salvar(estado: OnboardingState) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(estado))
  } catch {
    // Sem localStorage (modo privado, SSR): o mock segue só em memória.
  }
}

function carregar(): OnboardingState | null {
  try {
    const bruto = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!bruto) return null
    const estado = JSON.parse(bruto) as OnboardingState
    return STATUSES.includes(estado.status) ? estado : null
  } catch {
    return null
  }
}

/** `?mock=aprovado` (ou outro status) na URL escolhe o cenário. */
function statusDaUrl(): OnboardingStatus | null {
  try {
    const valor = new URLSearchParams(globalThis.location?.search ?? '').get('mock')
    const status = valor?.toUpperCase() as OnboardingStatus | undefined
    return status && STATUSES.includes(status) ? status : null
  } catch {
    return null
  }
}

function estadoInicial(): OnboardingState {
  const daUrl = statusDaUrl()
  if (daUrl) {
    const estado = cenario(daUrl)
    salvar(estado)
    return estado
  }
  return carregar() ?? cenario('NAO_INICIADO')
}

let onboarding: OnboardingState = estadoInicial()

interface ReviewRecord {
  item: ReviewRegistro
  status: 'ANALISE_MANUAL' | 'APROVADO' | 'REPROVADO'
  comentario: string | null
}

let fila: ReviewRecord[] | null = null
let erpCache: Erp | null = null

/** Volta o mock ao estado inicial (ERP, fila e onboarding) no cenário pedido. */
export function resetMockDb(status: OnboardingStatus = 'NAO_INICIADO') {
  onboarding = cenario(status)
  salvar(onboarding)
  fila = null
  erpCache = null
  team.resetTeam()
}

/** Troca o cenário do onboarding mantendo os dados do ERP (barra de dev). */
export function setMockStatus(status: OnboardingStatus) {
  onboarding = cenario(status)
  salvar(onboarding)
}

/** Estado atual, aplicando a conclusão da análise automática ~8 s após o envio. */
export function estadoOnboarding(): OnboardingState {
  const { status, submittedAt } = onboarding
  if (status === 'EM_ANALISE' && submittedAt) {
    if (Date.now() - new Date(submittedAt).getTime() >= ANALISE_MS) {
      onboarding = {
        ...onboarding,
        status: onboarding.segmento === 'outro' ? 'ANALISE_MANUAL' : 'APROVADO',
      }
      salvar(onboarding)
    }
  }
  return onboarding
}

export function me(): Me {
  const estado = estadoOnboarding()
  const semCustomer = estado.status === 'NAO_INICIADO'
  return {
    customer_id: semCustomer ? null : CUSTOMER_ID,
    onboarding_status: estado.status,
    empresa: estado.empresa,
    membro: semCustomer ? null : team.membroResumo(),
  }
}

export function rascunho(): OnboardingDraft {
  const estado = estadoOnboarding()
  const draft: OnboardingDraft = {
    empresa: estado.empresa,
    segmento: estado.segmento,
    respostas: estado.respostas,
    observacoes: estado.observacoes,
    onboarding_status: estado.status,
    updated_at: estado.updatedAt,
  }
  // Campo proposto ao Onboarding (ainda fora do contrato): o comentário da reprovação.
  return estado.status === 'REPROVADO' && estado.reviewComment
    ? Object.assign(draft, { review_comment: estado.reviewComment })
    : draft
}

function vazio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    (typeof valor === 'string' && valor.trim() === '') ||
    (Array.isArray(valor) && valor.length === 0) ||
    (typeof valor === 'number' && Number.isNaN(valor))
  )
}

const OBRIGATORIO = 'Campo obrigatório.'

/** Valida empresa, segmento e respostas do template (obrigatórios, tipos, limites e opções). */
export function validarOnboarding(
  empresa: Partial<Empresa> | null,
  segmento: Segmento | null,
  respostas: Respostas,
): CampoErro[] {
  const erros: CampoErro[] = []
  const obrigatoriosEmpresa: (keyof Empresa)[] = [
    'razao_social',
    'cnpj',
    'email',
    'telefone',
    'cidade',
    'estado',
  ]
  for (const campo of obrigatoriosEmpresa) {
    const valor = empresa?.[campo]
    if (vazio(valor)) erros.push({ campo: `empresa.${campo}`, erro: OBRIGATORIO })
    else if (campo === 'cnpj' && !cnpjValido(String(valor))) {
      erros.push({
        campo: 'empresa.cnpj',
        erro: 'CNPJ inválido: confira os dígitos verificadores.',
      })
    }
  }
  if (!segmento) return [...erros, { campo: 'segmento', erro: 'Escolha o segmento do negócio.' }]
  for (const campo of camposDe(segmento)) {
    const valor = respostas[campo.id]
    const condicional = campo.id === 'valor_estoque' && respostas.possui_estoque === true
    if (vazio(valor)) {
      if (campo.obrigatorio || condicional) erros.push({ campo: campo.id, erro: OBRIGATORIO })
      continue
    }
    const erro = erroDoValor(campo, valor)
    if (erro) erros.push({ campo: campo.id, erro })
  }
  return erros
}

function erroDoValor(campo: ReturnType<typeof camposDe>[number], valor: unknown): string | null {
  switch (campo.tipo) {
    case 'boolean':
      return typeof valor === 'boolean' ? null : 'Responda sim ou não.'
    case 'text':
      return typeof valor === 'string' ? null : 'Texto inválido.'
    case 'select':
      return campo.opcoes?.includes(String(valor)) ? null : 'Opção inválida.'
    case 'multiselect':
      return Array.isArray(valor) && valor.every((v) => campo.opcoes?.includes(v))
        ? null
        : 'Opção inválida.'
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'Informe um número.'
  if (campo.tipo === 'integer' && !Number.isInteger(valor)) return 'Informe um número inteiro.'
  const { min, max } = campo
  if ((min !== undefined && valor < min) || (max !== undefined && valor > max)) {
    if (max === undefined) return `O valor mínimo é ${min}.`
    return `Informe um valor entre ${min ?? 0} e ${max}.`
  }
  return null
}

const UFS = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
)

/**
 * Como a API real (pydantic): mesmo no rascunho, cada campo da empresa que vier preenchido
 * precisa ser válido, senão o PUT inteiro volta 422. `null` sempre passa.
 */
export function validarEmpresaRascunho(empresa: Partial<Empresa> | null): CampoErro[] {
  if (!empresa) return []
  const erros: CampoErro[] = []
  const erro = (campo: keyof Empresa, mensagem: string) =>
    erros.push({ campo: `empresa.${campo}`, erro: mensagem })
  const presente = (valor: unknown) => valor !== null && valor !== undefined
  for (const campo of ['razao_social', 'nome_fantasia'] as const) {
    const valor = empresa[campo]
    if (presente(valor) && String(valor).length > 160) erro(campo, 'Máximo de 160 caracteres.')
  }
  if (presente(empresa.cnpj) && !cnpjValido(String(empresa.cnpj))) {
    erro('cnpj', 'CNPJ inválido.')
  }
  if (presente(empresa.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(empresa.email))) {
    erro('email', 'E-mail inválido.')
  }
  if (presente(empresa.telefone)) {
    const tamanho = String(empresa.telefone).length
    if (tamanho < 8 || tamanho > 20) erro('telefone', 'Telefone inválido.')
  }
  if (presente(empresa.estado) && !UFS.has(String(empresa.estado))) erro('estado', 'UF inválida.')
  const { fundacao_ano: ano, funcionarios } = empresa
  if (presente(ano) && (typeof ano !== 'number' || ano < 1800 || ano > 2100)) {
    erro('fundacao_ano', 'Ano inválido.')
  }
  if (
    presente(funcionarios) &&
    (typeof funcionarios !== 'number' || funcionarios < 0 || funcionarios > 2 ** 31 - 1)
  ) {
    erro('funcionarios', 'Número de funcionários inválido.')
  }
  return erros
}

export type SalvarResultado =
  | { tipo: 'ok'; draft: OnboardingDraft }
  | { tipo: 'conflito'; detail: string }
  | { tipo: 'invalido'; erros: CampoErro[] }

export function salvarOnboarding(payload: Partial<OnboardingPayload>): SalvarResultado {
  const atual = estadoOnboarding()
  if (['EM_ANALISE', 'ANALISE_MANUAL', 'APROVADO'].includes(atual.status)) {
    return { tipo: 'conflito', detail: `Onboarding já enviado (status ${atual.status}).` }
  }
  // PUT substitui o estado inteiro; e-mail e telefone ausentes voltam `null`.
  const empresa =
    payload.empresa && typeof payload.empresa === 'object'
      ? {
          ...payload.empresa,
          email: payload.empresa.email ?? null,
          telefone: payload.empresa.telefone ?? null,
        }
      : null
  const segmento = SEGMENTOS.includes(payload.segmento as Segmento)
    ? (payload.segmento as Segmento)
    : null
  const respostas =
    payload.respostas && typeof payload.respostas === 'object' ? payload.respostas : {}
  const observacoes = typeof payload.observacoes === 'string' ? payload.observacoes : ''
  const agora = new Date().toISOString()
  const erros = payload.enviar
    ? validarOnboarding(empresa, segmento, respostas)
    : validarEmpresaRascunho(empresa)
  if (erros.length > 0) return { tipo: 'invalido', erros }
  onboarding = {
    status: payload.enviar ? 'EM_ANALISE' : 'RASCUNHO',
    empresa,
    segmento,
    respostas,
    observacoes,
    updatedAt: agora,
    submittedAt: payload.enviar ? agora : null,
  }
  salvar(onboarding)
  // Novo faturamento = nova escala dos dados do ERP.
  erpCache = null
  return { tipo: 'ok', draft: rascunho() }
}

// ---------- fila de análise manual ----------

function resumo(analise: BusinessAnalysis | null): AnaliseResumo | null {
  if (!analise) return null
  const { score, faixa_risco, gerado_por, status } = analise
  return { score, faixa_risco, gerado_por, status }
}

function comResumo(item: ReviewRegistro): ReviewItem {
  return { ...item, analise: resumo(item.analise) }
}

function registrosFila(): ReviewRecord[] {
  fila ??= filaInicial(new Date()).map((item) => ({
    item,
    status: 'ANALISE_MANUAL' as const,
    comentario: null,
  }))
  return fila
}

/** Item do cliente logado quando ele está na análise manual. */
function itemDoCliente(): ReviewRegistro | null {
  const estado = estadoOnboarding()
  if (estado.status !== 'ANALISE_MANUAL' || !estado.empresa || !estado.segmento) return null
  return {
    customer_id: CUSTOMER_ID,
    empresa: estado.empresa,
    segmento: estado.segmento,
    observacoes: estado.observacoes,
    analise: analiseAtual(),
    submitted_at: estado.submittedAt ?? new Date().toISOString(),
  }
}

/** Fila por status, do envio mais antigo para o mais novo. */
export function reviews(status = 'ANALISE_MANUAL'): ReviewItem[] {
  const itens = registrosFila()
    .filter((registro) => registro.status === status)
    .map((registro) => registro.item)
  const cliente = status === 'ANALISE_MANUAL' ? itemDoCliente() : null
  return (cliente ? [cliente, ...itens] : itens)
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
    .map(comResumo)
}

export const REVIEWER = 'analista@erpia.com.br'

export type DecidirResultado =
  | { tipo: 'ok'; resultado: ReviewDecisionResult }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'conflito'; detail: string }

/** Decide um item da fila: 404 se não existe, 409 se não está em ANALISE_MANUAL. */
export function decidir(customerId: number, decisao: ReviewDecision): DecidirResultado {
  const resultado: ReviewDecisionResult = {
    customer_id: customerId,
    onboarding_status: decisao.decisao,
    decisao: decisao.decisao,
    comentario: decisao.comentario,
    reviewer: REVIEWER,
    reviewed_at: new Date().toISOString(),
  }
  const conflito = (status: string) => ({
    tipo: 'conflito' as const,
    detail: `Cliente não está em análise manual (status ${status}).`,
  })
  if (customerId === CUSTOMER_ID) {
    const { status } = estadoOnboarding()
    if (status === 'NAO_INICIADO') return { tipo: 'nao_encontrado' }
    if (status !== 'ANALISE_MANUAL') return conflito(status)
    onboarding = {
      ...onboarding,
      status: decisao.decisao,
      reviewComment: decisao.comentario || null,
    }
    salvar(onboarding)
    return { tipo: 'ok', resultado }
  }
  const registro = registrosFila().find((r) => r.item.customer_id === customerId)
  if (!registro) return { tipo: 'nao_encontrado' }
  if (registro.status !== 'ANALISE_MANUAL') return conflito(registro.status)
  registro.status = decisao.decisao
  registro.comentario = decisao.comentario
  return { tipo: 'ok', resultado }
}

// ---------- ERP do cliente ----------

interface RegistroSimulacao {
  simulation: Simulation
  receivableIds: number[]
  usada: boolean
}

interface Erp {
  dia: string
  escala: number
  saldo: number
  vendas: VendaDia[]
  receivables: Receivable[]
  payables: Payable[]
  payments: Payment[]
  statement: StatementEntry[]
  inventory: InventoryItem[]
  creditRequests: PortalCreditRequest[]
  simulations: Map<string, RegistroSimulacao>
  rng: () => number
  seq: { payable: number; payment: number; statement: number; credit: number; simulation: number }
}

function escalaAtual(): number {
  const faturamento = onboarding.respostas.faturamento_mensal
  if (typeof faturamento !== 'number' || !(faturamento > 0)) return 1
  return Math.min(50, Math.max(0.05, faturamento / RECEITA_BASE))
}

function gerarErp(): Erp {
  const base = hoje()
  const escala = escalaAtual()
  const rng = mulberry32(CUSTOMER_ID)
  const vendas = gerarVendas(base, RECEITA_BASE * escala, rng)
  // Encomenda corporativa de Natal paga por boleto: entra logo depois do vale.
  const boleto = r2(46_800 * escala)
  const lotes = gerarRecebiveis(base, vendas, [
    {
      vencimento: isoDate(addDias(base, 27)),
      adquirente: 'Boleto — Grupo Vitta',
      bruto: boleto,
      liquido: r2(boleto - 3.49),
    },
  ])
  const payables = gerarContas(base, escala, rng)
  const saldo = r2(SALDO_INICIAL * escala)
  const statement = gerarExtrato(base, saldo, vendas, lotes, payables)
  const payments = gerarPagamentos(payables, rng)
  const criado = addDias(base, -58)
  return {
    dia: isoDate(base),
    escala,
    saldo,
    vendas,
    receivables: paraRecebiveis(base, lotes),
    payables,
    payments,
    statement,
    inventory: gerarEstoque(base, escala),
    creditRequests: [
      {
        id: 801,
        customerId: CUSTOMER_ID,
        valorSolicitado: r2(18_000 * escala),
        prazoMeses: 1,
        scoreSnapshot: SCORE_CLIENTE,
        status: 'APROVADO',
        motivo: MOTIVOS.APROVADO,
        valorAprovado: r2(18_000 * escala),
        taxaJuros: 0.0209,
        criadoEm: new Date(criado.getTime() + 11 * 3_600_000).toISOString(),
      },
      {
        // Proposta acima do pré-aprovado, em revisão: vira a pendência PROPOSTA_CREDITO.
        id: 802,
        customerId: CUSTOMER_ID,
        valorSolicitado: r2(60_000 * escala),
        prazoMeses: 12,
        scoreSnapshot: SCORE_CLIENTE,
        status: 'REVISAO',
        motivo: 'Valor acima do limite pré-aprovado: em análise pelo time de crédito.',
        valorAprovado: null,
        taxaJuros: null,
        criadoEm: addDias(base, -2).toISOString(),
      },
    ],
    simulations: new Map(),
    rng,
    seq: {
      payable: 6001,
      payment: 7501,
      statement: 9901,
      // Depois das propostas semeadas (801 e 802): ids repetidos duplicam a chave na tabela.
      credit: 803,
      simulation: 1,
    },
  }
}

/** Dados do ERP, regenerados se o dia ou a escala mudarem. */
function erp(): Erp {
  if (!erpCache || erpCache.dia !== isoDate(hoje()) || erpCache.escala !== escalaAtual()) {
    erpCache = gerarErp()
  }
  // Conta em aberto que passou do vencimento volta como ATRASADO.
  for (const conta of erpCache.payables) {
    if (conta.status === 'ABERTO' && conta.vencimento < erpCache.dia) conta.status = 'ATRASADO'
  }
  return erpCache
}

export function onboardingAprovado(): boolean {
  return estadoOnboarding().status === 'APROVADO'
}

/** Percentuais com 1 casa, como o Transactions. */
function r1(valor: number): number {
  return Math.round(valor * 10) / 10
}

function soma<T>(itens: T[], valor: (item: T) => number): number {
  return r2(itens.reduce((total, item) => total + valor(item), 0))
}

function aberta(conta: Payable): boolean {
  return conta.status !== 'PAGO'
}

/** Data em que a conta sai do caixa (atrasada = hoje; agendada = data do agendamento). */
function dataSaida(e: Erp, conta: Payable): string {
  const agendamento = e.payments.find(
    (pagamento) => pagamento.payable_id === conta.id && pagamento.status === 'AGENDADO',
  )
  const data = agendamento?.agendado_para ?? conta.vencimento
  return data < e.dia ? e.dia : data
}

function vendasEntre(e: Erp, de: string, ate: string): VendaDia[] {
  return e.vendas.filter((dia) => dia.data >= de && dia.data <= ate)
}

/** Previsão por dia da semana a partir das últimas 4 semanas. */
function previsaoSemanal(e: Erp) {
  const base = parseIso(e.dia)
  const recentes = vendasEntre(e, isoDate(addDias(base, -28)), e.dia)
  return Array.from({ length: 7 }, (_, semana) => {
    const dias = recentes.filter((dia) => parseIso(dia.data).getDay() === semana)
    const media = (forma: FormaPagamento) =>
      dias.reduce((total, dia) => total + (dia.porForma[forma] ?? 0), 0) / dias.length
    const parcelado = dias.reduce((total, dia) => total + dia.creditoParcelado, 0) / dias.length
    return {
      imediato: media('PIX') + media('DINHEIRO'),
      debito: media('CARTAO_DEBITO'),
      credito: media('CARTAO_CREDITO') - parcelado,
    }
  })
}

/** Fluxo de caixa projetado de 60 dias: recebíveis + vendas previstas − contas em aberto. */
export function fluxoCaixa(e: Erp = erp()): FluxoCaixaDia[] {
  const base = parseIso(e.dia)
  const previsao = previsaoSemanal(e)
  const prever = (offset: number) => previsao[addDias(base, offset).getDay()]
  const saidasPorDia = new Map<string, number>()
  for (const conta of e.payables.filter(aberta)) {
    const data = dataSaida(e, conta)
    saidasPorDia.set(data, (saidasPorDia.get(data) ?? 0) + conta.valor)
  }
  let saldo = e.saldo
  const dias: FluxoCaixaDia[] = []
  for (let offset = 0; offset < 60; offset++) {
    const data = isoDate(addDias(base, offset))
    let entradas = soma(
      e.receivables.filter((r) => r.status === 'PREVISTO' && r.vencimento === data),
      (r) => r.valor_liquido,
    )
    entradas += prever(offset).imediato
    if (offset >= 1) entradas += prever(offset - 1).debito * 0.98
    if (offset >= 30) entradas += prever(offset - 30).credito * 0.97
    const saidas = saidasPorDia.get(data) ?? 0
    saldo += entradas - saidas
    dias.push({ data, entradas: r2(entradas), saidas: r2(saidas), saldo_projetado: r2(saldo) })
  }
  return dias
}

function jurosAtraso(conta: Payable, dia: string): { dias: number; juros: number } {
  const dias = Math.max(0, diasEntre(conta.vencimento, dia))
  return { dias, juros: r2(conta.valor * (0.02 + (0.01 * dias) / 30)) }
}

function valorEstoque(e: Erp): number {
  return soma(e.inventory, (item) => item.quantidade * item.custo_unitario)
}

function margemPct(): number {
  const margem = onboarding.respostas.margem_bruta_pct
  return typeof margem === 'number' && margem > 0 && margem < 100 ? margem : 58
}

function numeroResposta(id: string, padrao: number): number {
  const valor = onboarding.respostas[id]
  return typeof valor === 'number' && valor >= 0 ? valor : padrao
}

/** Métricas que alimentam a análise, os insights e as ofertas. */
export function metricas(e: Erp = erp()): MetricasNegocio {
  const base = parseIso(e.dia)
  const ultimos = vendasEntre(e, isoDate(addDias(base, -30)), isoDate(addDias(base, -1)))
  const anteriores = vendasEntre(e, isoDate(addDias(base, -60)), isoDate(addDias(base, -31)))
  const receita = soma(ultimos, (dia) => dia.valor)
  const receitaAnterior = soma(anteriores, (dia) => dia.valor)
  const quantidade = ultimos.reduce((total, dia) => total + dia.quantidade, 0)
  const forma = (f: FormaPagamento) => soma(ultimos, (dia) => dia.porForma[f] ?? 0)
  const canal = (c: string) => soma(ultimos, (dia) => dia.porCanal[c] ?? 0)
  const parcelado = soma(ultimos, (dia) => dia.creditoParcelado)
  const credito = forma('CARTAO_CREDITO')
  const fimSemana = soma(
    ultimos.filter((dia) => [0, 6].includes(parseIso(dia.data).getDay())),
    (dia) => dia.valor,
  )
  const margem = margemPct()
  const estoque = valorEstoque(e)
  const fluxo = fluxoCaixa(e)
  const inicio = fluxo.findIndex((dia) => dia.saldo_projetado < 0)
  let fim: number | null = null
  if (inicio >= 0) {
    const volta = fluxo.findIndex((dia, i) => i > inicio && dia.saldo_projetado >= 0)
    fim = volta < 0 ? fluxo.length - 1 : volta - 1
  }
  const minimo = Math.min(...fluxo.map((dia) => dia.saldo_projetado))
  const previstos = e.receivables.filter((r) => r.status === 'PREVISTO')
  const semana = isoDate(addDias(base, 7))
  const boletos = e.payables
    .filter((c) => aberta(c) && c.codigo_barras && c.vencimento <= semana)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  let restante = e.saldo
  let cobertos = 0
  for (const boleto of boletos) {
    if (boleto.valor > restante) break
    restante -= boleto.valor
    cobertos++
  }
  const atrasos = e.payables
    .filter((c) => c.status === 'ATRASADO')
    .map((c) => ({ fornecedor: c.fornecedor, ...jurosAtraso(c, e.dia) }))
    .sort((a, b) => b.juros - a.juros)
  const baseLimite = {
    recebiveis: soma(previstos, (r) => r.valor_bruto),
    estoque,
    receitaMensal: receita,
  }
  return {
    receitaMensal: receita,
    receitaAnterior,
    receitaVariacaoPct:
      receitaAnterior > 0 ? r2(((receita - receitaAnterior) / receitaAnterior) * 100) : 0,
    ticketMedio: r2(receita / quantidade),
    pctCredito: (credito / receita) * 100,
    pctFimSemana: (fimSemana / receita) * 100,
    pctDelivery: ((canal('iFood') + canal('WhatsApp')) / receita) * 100,
    margemPct: margem,
    pmr: (forma('CARTAO_DEBITO') + (credito - parcelado) * 30 + parcelado * 60) / receita,
    pmp: numeroResposta('prazo_medio_pagamento_dias', 21),
    coberturaEstoque: estoque / ((receita * (1 - margem / 100)) / 30),
    dividas: numeroResposta('dividas_total', 210_000 * e.escala),
    parcelaMensal: numeroResposta('parcela_dividas_mensal', 9_800 * e.escala),
    recebiveis90: soma(previstos, (r) => r.valor_liquido),
    valeInicio: inicio >= 0 ? inicio : null,
    valeFim: fim,
    valeMinimo: Math.min(0, minimo),
    antecipacaoSugerida: minimo < 0 ? Math.ceil((-minimo * 1.1) / 1000) * 1000 : 0,
    boletosSemana: boletos.length,
    boletosCobertos: cobertos,
    estoqueValor: estoque,
    estoqueParado: soma(
      e.inventory.filter((item) => item.giro_dias > 120),
      (item) => item.quantidade * item.custo_unitario,
    ),
    abaixoMinimo: e.inventory.filter((item) => item.quantidade < item.minimo).length,
    maiorAtraso: atrasos[0] ?? null,
    limites: {
      ANTECIPACAO_RECEBIVEIS: limiteProduto('ANTECIPACAO_RECEBIVEIS', baseLimite),
      CAPITAL_DE_GIRO: limiteProduto('CAPITAL_DE_GIRO', baseLimite),
      ALAVANCAGEM: limiteProduto('ALAVANCAGEM', baseLimite),
      FINANCIAMENTO_ESTOQUE: limiteProduto('FINANCIAMENTO_ESTOQUE', baseLimite),
      CONSOLIDACAO_DIVIDAS: limiteProduto('CONSOLIDACAO_DIVIDAS', baseLimite),
    },
  }
}

// ---------- análise (Score) ----------

export const SCORE_CLIENTE = 742

/** Análise do cliente logado; `null` antes do envio do onboarding. */
export function analiseAtual(): BusinessAnalysis | null {
  const estado = estadoOnboarding()
  if (estado.status === 'NAO_INICIADO' || estado.status === 'RASCUNHO') return null
  const status = estado.status
  const enviado = estado.submittedAt ? new Date(estado.submittedAt).getTime() : Date.now()
  const atualizado = new Date(status === 'EM_ANALISE' ? enviado : enviado + ANALISE_MS)
  return analiseNegocio(CUSTOMER_ID, status, metricas(), hoje(), atualizado.toISOString())
}

export function analiseDe(customerId: number): BusinessAnalysis | null {
  if (customerId === CUSTOMER_ID) return analiseAtual()
  return registrosFila().find((r) => r.item.customer_id === customerId)?.item.analise ?? null
}

// ---------- relatórios /me ----------

export function overview(): Overview {
  const e = erp()
  const m = metricas(e)
  const base = parseIso(e.dia)
  const limite30 = isoDate(addDias(base, 30))
  const ultimos = vendasEntre(e, isoDate(addDias(base, -30)), isoDate(addDias(base, -1)))
  return {
    saldo: e.saldo,
    conta: { ...CONTA },
    receita_30d: m.receitaMensal,
    receita_30d_variacao_pct: m.receitaAnterior > 0 ? r1(m.receitaVariacaoPct) : null,
    ticket_medio_30d: r2(m.receitaMensal / ultimos.reduce((t, dia) => t + dia.quantidade, 0)),
    recebiveis_90d: m.recebiveis90,
    a_pagar_30d: soma(
      e.payables.filter((c) => aberta(c) && c.vencimento <= limite30),
      (c) => c.valor,
    ),
    atrasados_total: soma(
      e.payables.filter((c) => c.status === 'ATRASADO'),
      (c) => c.valor,
    ),
    estoque_valor: m.estoqueValor,
    pendencias_count: pendencias().length,
    fluxo_caixa: fluxoCaixa(e),
  }
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

function dataValida(valor: string | null | undefined): string | null {
  return valor && DATA_ISO.test(valor) ? valor : null
}

export interface Periodo {
  from?: string | null
  to?: string | null
}

function periodo(chave: string, groupBy: GroupBy): string {
  if (groupBy === 'week') return inicioSemana(chave)
  if (groupBy === 'month') return chave.slice(0, 7)
  return chave
}

function comPct<T extends { valor: number }>(itens: T[], total: number): (T & { pct: number })[] {
  return itens
    .map((item) => ({
      ...item,
      valor: r2(item.valor),
      pct: total ? r1((item.valor / total) * 100) : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
}

/** Vendas do período (padrão: últimos 30 dias até ontem). */
export function vendas(query: Periodo & { group_by?: string | null }): SalesReport {
  const e = erp()
  const base = parseIso(e.dia)
  const de = dataValida(query.from) ?? isoDate(addDias(base, -30))
  const ate = dataValida(query.to) ?? isoDate(addDias(base, -1))
  const groupBy: GroupBy = ['day', 'week', 'month'].includes(query.group_by ?? '')
    ? (query.group_by as GroupBy)
    : 'day'
  const dias = vendasEntre(e, de, ate)
  // Série preenchida com zeros: todo período do intervalo aparece, mesmo sem venda.
  const serie = new Map<string, { valor: number; quantidade: number }>()
  for (let data = parseIso(de); isoDate(data) <= ate; data = addDias(data, 1)) {
    serie.set(periodo(isoDate(data), groupBy), { valor: 0, quantidade: 0 })
  }
  const formas = new Map<string, number>()
  const canais = new Map<string, number>()
  const produtos = new Map<string, { valor: number; quantidade: number }>()
  for (const dia of dias) {
    const chave = periodo(dia.data, groupBy)
    const ponto = serie.get(chave) ?? { valor: 0, quantidade: 0 }
    ponto.valor += dia.valor
    ponto.quantidade += dia.quantidade
    serie.set(chave, ponto)
    for (const [forma, valor] of Object.entries(dia.porForma)) {
      formas.set(forma, (formas.get(forma) ?? 0) + valor)
    }
    for (const [canal, valor] of Object.entries(dia.porCanal)) {
      canais.set(canal, (canais.get(canal) ?? 0) + valor)
    }
    for (const [sku, venda] of Object.entries(dia.porProduto)) {
      const atual = produtos.get(sku) ?? { valor: 0, quantidade: 0 }
      atual.valor += venda.valor
      atual.quantidade += venda.quantidade
      produtos.set(sku, atual)
    }
  }
  const total = soma(dias, (dia) => dia.valor)
  const quantidade = dias.reduce((t, dia) => t + dia.quantidade, 0)
  return {
    serie: [...serie.entries()].map(([chave, ponto]) => ({
      periodo: chave,
      valor: r2(ponto.valor),
      quantidade: ponto.quantidade,
    })),
    por_forma_pagamento: comPct(
      [...formas.entries()].map(([forma, valor]) => ({ forma: forma as FormaPagamento, valor })),
      total,
    ),
    por_canal: comPct(
      [...canais.entries()].map(([canal, valor]) => ({ canal, valor })),
      total,
    ),
    top_produtos: [...produtos.entries()]
      .map(([sku, venda]) => ({
        sku,
        nome: PRODUTOS.find((p) => p.sku === sku)?.nome ?? sku,
        valor: r2(venda.valor),
        quantidade: venda.quantidade,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
    total,
    ticket_medio: quantidade ? r2(total / quantidade) : 0,
  }
}

export function recebiveis(query: Periodo & { status?: string | null }): ReceivablesReport {
  const e = erp()
  const de = dataValida(query.from)
  const ate = dataValida(query.to)
  const itens = e.receivables.filter(
    (r) =>
      (!query.status || r.status === query.status) &&
      (!de || r.vencimento >= de) &&
      (!ate || r.vencimento <= ate),
  )
  const semanas = new Map<string, number>()
  for (const r of itens.filter((item) => item.status === 'PREVISTO')) {
    const semana = inicioSemana(r.vencimento)
    semanas.set(semana, (semanas.get(semana) ?? 0) + r.valor_liquido)
  }
  return {
    itens: itens.map((r) => ({ ...r })),
    total_previsto: soma(
      itens.filter((r) => r.status === 'PREVISTO'),
      (r) => r.valor_liquido,
    ),
    por_semana: [...semanas.entries()].map(([semana, valor]) => ({ semana, valor: r2(valor) })),
  }
}

export function contas(status?: string | null): PayablesReport {
  const e = erp()
  const filtro = status ? status.split(',').map((s) => s.trim().toUpperCase()) : null
  const semana = isoDate(addDias(parseIso(e.dia), 7))
  return {
    itens: e.payables.filter((c) => !filtro || filtro.includes(c.status)).map((c) => ({ ...c })),
    total_aberto: soma(
      e.payables.filter((c) => c.status === 'ABERTO' || c.status === 'AGENDADO'),
      (c) => c.valor,
    ),
    total_atrasado: soma(
      e.payables.filter((c) => c.status === 'ATRASADO'),
      (c) => c.valor,
    ),
    proximos_7d: soma(
      e.payables.filter((c) => aberta(c) && c.vencimento >= e.dia && c.vencimento <= semana),
      (c) => c.valor,
    ),
  }
}

export function pagamentos(): Payment[] {
  // Mais recente primeiro (compara instantes, não strings).
  return [...erp().payments].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime() || b.id - a.id,
  )
}

/** Extrato do mais recente para o mais antigo (padrão: últimos 30 dias). */
export function extrato(query: Periodo): StatementEntry[] {
  const e = erp()
  const de = dataValida(query.from) ?? isoDate(addDias(parseIso(e.dia), -30))
  const ate = dataValida(query.to)
  return e.statement.filter((entrada) => {
    const dia = dataSp(entrada.data)
    return dia >= de && (!ate || dia <= ate)
  })
}

export function estoque(): InventoryReport {
  const e = erp()
  const m = metricas(e)
  return {
    itens: e.inventory.map((item) => ({ ...item })),
    valor_total: m.estoqueValor,
    valor_parado: soma(
      e.inventory.filter((item) => item.giro_dias > 90),
      (item) => item.quantidade * item.custo_unitario,
    ),
    abaixo_minimo: m.abaixoMinimo,
    cobertura_media_dias: Math.round(m.coberturaEstoque * 10) / 10,
  }
}

function lancar(e: Erp, descricao: string, tipo: StatementEntry['tipo'], valor: number) {
  e.saldo = r2(e.saldo + (tipo === 'CREDIT' ? valor : -valor))
  e.statement.unshift({
    id: e.seq.statement++,
    data: new Date().toISOString(),
    descricao,
    tipo,
    valor: r2(valor),
    saldo_apos: e.saldo,
  })
}

// ---------- pendências ----------

export function pendencias(): Pendencia[] {
  const e = erp()
  const m = metricas(e)
  const lista: Pendencia[] = []
  if (m.valeInicio !== null) {
    const data = isoDate(addDias(parseIso(e.dia), m.valeInicio))
    lista.push({
      id: 'saldo-insuficiente',
      tipo: 'SALDO_INSUFICIENTE',
      titulo: `Caixa negativo em ${m.valeInicio} dias`,
      descricao: `O saldo projetado chega a ${reais(m.valeMinimo)}. Antecipar ${mil(m.antecipacaoSugerida)} de recebíveis cobre o vale.`,
      valor: r2(-m.valeMinimo),
      data,
      acao: {
        label: 'Antecipar recebíveis',
        rota: '/app/recebiveis',
        credito: { produto: 'ANTECIPACAO_RECEBIVEIS', valor: m.antecipacaoSugerida },
      },
    })
  }
  for (const conta of e.payables.filter((c) => c.status === 'ATRASADO')) {
    const { dias, juros } = jurosAtraso(conta, e.dia)
    lista.push({
      id: `payable-${conta.id}`,
      tipo: 'CONTA_ATRASADA',
      titulo: `${conta.fornecedor} atrasado há ${dias} dias`,
      descricao: `Juros e multa estimados de ${reais(juros)}. Pague hoje para evitar protesto.`,
      valor: conta.valor,
      data: conta.vencimento,
      acao: {
        label: 'Pagar agora',
        rota: `/app/pagamentos?conta=${conta.id}`,
        ...(conta.valor > e.saldo
          ? { credito: { produto: 'CAPITAL_DE_GIRO' as const, valor: Math.ceil(conta.valor) } }
          : {}),
      },
    })
  }
  for (const conta of e.payables.filter((c) => c.status === 'ABERTO' && c.vencimento === e.dia)) {
    lista.push({
      id: `payable-${conta.id}`,
      tipo: 'VENCE_HOJE',
      titulo: `${conta.fornecedor} vence hoje`,
      descricao: `Boleto de ${reais(conta.valor)}.`,
      valor: conta.valor,
      data: conta.vencimento,
      acao: { label: 'Pagar', rota: `/app/pagamentos?conta=${conta.id}` },
    })
  }
  for (const [indice, item] of e.inventory.entries()) {
    if (!item.abaixo_minimo) continue
    const reposicao = r2((item.minimo - item.quantidade) * item.custo_unitario)
    lista.push({
      id: `inventory-low-${indice + 1}`,
      tipo: 'ESTOQUE_BAIXO',
      titulo: `${item.nome} abaixo do mínimo`,
      descricao: `${item.quantidade} em estoque para um mínimo de ${item.minimo}. Repor custa ${reais(reposicao)}.`,
      valor: reposicao,
      data: e.dia,
      acao: {
        label: 'Repor com financiamento',
        rota: '/app/estoque',
        credito: { produto: 'FINANCIAMENTO_ESTOQUE', valor: Math.ceil(reposicao) },
      },
    })
  }
  for (const [indice, item] of e.inventory.entries()) {
    if (!item.parado) continue
    const parado = r2(item.quantidade * item.custo_unitario)
    lista.push({
      id: `inventory-idle-${indice + 1}`,
      tipo: 'ESTOQUE_PARADO',
      titulo: `${item.nome} parado há ${item.giro_dias} dias`,
      descricao: `${reais(parado)} em estoque sem giro. Que tal uma promoção ou montar cestas de Natal?`,
      valor: parado,
      data: e.dia,
      acao: { label: 'Ver item', rota: `/app/estoque?sku=${item.sku}` },
    })
  }
  for (const proposta of e.creditRequests.filter((r) => r.status === 'REVISAO')) {
    lista.push({
      id: `credit-request-${proposta.id}`,
      tipo: 'PROPOSTA_CREDITO',
      titulo: 'Proposta de crédito em análise',
      descricao: proposta.motivo ?? 'Aguardando o time de crédito.',
      valor: proposta.valorSolicitado,
      data: dataSp(proposta.criadoEm),
      acao: { label: 'Acompanhar', rota: '/app/credito' },
    })
  }
  return lista
}

// ---------- pagamentos ----------

/** Erro HTTP do Transactions: `{error, message, ...}`. */
export interface ErroApi {
  tipo: 'erro'
  http: number
  body: { error: string; message: string } & Record<string, unknown>
}

function erro(http: number, error: string, message: string, extra = {}): ErroApi {
  return { tipo: 'erro', http, body: { error, message, ...extra } }
}

/** 400 de validação: `{error:"validation_failed", message, campos:{campo: msg}}`. */
function validacao(campos: Record<string, string>): ErroApi {
  return erro(400, 'validation_failed', 'Dados inválidos.', { campos })
}

export type PagarResultado = { tipo: 'ok'; resposta: PaymentResponse } | ErroApi

const TIPOS_PAGAMENTO = ['PIX', 'BOLETO', 'TED']

export function pagar(req: Partial<PaymentRequest>): PagarResultado {
  const e = erp()
  const campos: Record<string, string> = {}
  if (!TIPOS_PAGAMENTO.includes(req.tipo ?? '')) campos.tipo = 'Use PIX, BOLETO ou TED.'
  if (typeof req.valor !== 'number' || !(req.valor > 0)) {
    campos.valor = 'Informe um valor maior que zero.'
  }
  if (typeof req.destinatario !== 'string' || !req.destinatario.trim()) {
    campos.destinatario = 'Informe o destinatário.'
  }
  if (req.agendado_para !== undefined && !dataValida(req.agendado_para)) {
    campos.agendado_para = 'Use a data no formato yyyy-MM-dd.'
  } else if (req.agendado_para !== undefined && req.agendado_para < e.dia) {
    campos.agendado_para = 'A data do agendamento não pode estar no passado.'
  }
  if (Object.keys(campos).length > 0) return validacao(campos)
  const conta = req.payable_id ? e.payables.find((c) => c.id === req.payable_id) : undefined
  if (req.payable_id && !conta) {
    return erro(404, 'CONTA_A_PAGAR_NAO_ENCONTRADA', 'Conta a pagar não encontrada.')
  }
  if (conta?.status === 'PAGO') return erro(422, 'CONTA_JA_PAGA', 'Esta conta já foi paga.')
  if (conta?.status === 'AGENDADO') {
    return erro(422, 'CONTA_JA_AGENDADA', 'Esta conta já tem um pagamento agendado.')
  }
  if (conta && r2(req.valor as number) !== conta.valor) {
    return erro(422, 'VALOR_DIVERGENTE', 'O valor informado difere do valor da conta.')
  }
  const agendado = dataValida(req.agendado_para)
  const futuro = agendado !== null && agendado > e.dia
  const valor = r2(req.valor as number)
  if (!futuro && valor > e.saldo) {
    return erro(422, 'SALDO_INSUFICIENTE', 'Saldo insuficiente.', { faltam: r2(valor - e.saldo) })
  }

  const tipo = req.tipo as PaymentRequest['tipo']
  const destinatario = req.destinatario as string
  const descricao = req.descricao?.trim() || `Pagamento ${tipo}`
  const codigoBarras = req.codigo_barras ?? conta?.codigo_barras ?? null

  // Acima do limite do membro: fica pendente de aprovação, sem débito (seção 11).
  const limite = team.membroAtual().limite_pagamento
  if (limite !== null && valor > limite) {
    const pendente: Payment = {
      id: e.seq.payment++,
      tipo,
      destinatario,
      valor,
      descricao,
      payable_id: conta?.id ?? null,
      agendado_para: futuro ? agendado : null,
      codigo_barras: codigoBarras,
      status: 'PENDENTE_APROVACAO',
      autenticacao: null,
      criado_em: new Date().toISOString(),
      created_by_nome: team.membroAtual().nome,
    }
    e.payments.push(pendente)
    return {
      tipo: 'ok',
      resposta: {
        id: pendente.id,
        status: 'PENDENTE_APROVACAO',
        autenticacao: '',
        saldo_apos: e.saldo,
        comprovante: {
          tipo,
          valor,
          destinatario,
          descricao,
          data_hora: pendente.criado_em,
          agendado_para: pendente.agendado_para,
          autenticacao: '',
          conta_origem: { ...CONTA },
          codigo_barras: codigoBarras,
        },
      },
    }
  }
  const auth = autenticacao(e.rng)
  if (futuro) {
    if (conta) conta.status = 'AGENDADO'
  } else {
    lancar(e, `${tipo} — ${destinatario}`, 'DEBIT', valor)
    if (conta) {
      conta.status = 'PAGO'
      conta.pago_em = e.dia
    }
  }
  const agora = new Date().toISOString()
  const status: PaymentResponse['status'] = futuro ? 'AGENDADO' : 'EFETIVADO'
  const autor = team.membroAtual()
  const pagamento: Payment = {
    id: e.seq.payment++,
    tipo,
    destinatario,
    valor,
    descricao,
    payable_id: conta?.id ?? null,
    agendado_para: futuro ? agendado : null,
    codigo_barras: codigoBarras,
    status,
    autenticacao: auth,
    criado_em: agora,
    created_by_nome: autor.nome,
  }
  e.payments.push(pagamento)
  return {
    tipo: 'ok',
    resposta: {
      id: pagamento.id,
      status,
      autenticacao: auth,
      saldo_apos: e.saldo,
      comprovante: {
        tipo,
        valor,
        destinatario,
        descricao,
        data_hora: agora,
        agendado_para: pagamento.agendado_para,
        autenticacao: auth,
        conta_origem: { ...CONTA },
        codigo_barras: codigoBarras,
      },
    },
  }
}

// ---------- crédito ----------

/** Produtos ofertados, na ordem do Transactions (consolidação não é ofertada). */
const PRODUTOS_OFERTADOS: ProdutoCredito[] = [
  'ANTECIPACAO_RECEBIVEIS',
  'CAPITAL_DE_GIRO',
  'ALAVANCAGEM',
  'FINANCIAMENTO_ESTOQUE',
]
const PRODUTOS_CREDITO: ProdutoCredito[] = [...PRODUTOS_OFERTADOS, 'CONSOLIDACAO_DIVIDAS']

const NOME_PRODUTO: Record<ProdutoCredito, string> = {
  ANTECIPACAO_RECEBIVEIS: 'antecipação de recebíveis',
  CAPITAL_DE_GIRO: 'capital de giro',
  ALAVANCAGEM: 'crédito para expansão',
  FINANCIAMENTO_ESTOQUE: 'financiamento de estoque',
  CONSOLIDACAO_DIVIDAS: 'consolidação de dívidas',
}

/** Ofertas por produto; vazio quando a faixa é MUITO_ALTO. */
export function ofertas(faixa = faixaDoScore(SCORE_CLIENTE)): CreditOffer[] {
  if (TAXA_BASE[faixa] === null) return []
  const m = metricas()
  return PRODUTOS_OFERTADOS.map((produto) => ({
    produto,
    limite: m.limites[produto],
    taxa_mensal_a_partir: taxaMensal(faixa, produto) ?? 0,
    prazo_max_meses: PRAZO_MAX_MESES[produto],
  }))
}

export type SimularResultado = { tipo: 'ok'; simulation: Simulation } | ErroApi

export function simularCredito(req: Partial<SimulationRequest>): SimularResultado {
  const e = erp()
  const campos: Record<string, string> = {}
  const produto = req.produto as ProdutoCredito
  if (!PRODUTOS_CREDITO.includes(produto)) campos.produto = 'Produto inválido.'
  if (typeof req.valor !== 'number' || !(req.valor > 0)) {
    campos.valor = 'Informe um valor maior que zero.'
  }
  const prazo = req.prazo_meses
  if (typeof prazo !== 'number' || !Number.isInteger(prazo) || prazo < 1) {
    campos.prazo_meses = 'Informe o prazo em meses.'
  } else if (!campos.produto && prazo > PRAZO_MAX_MESES[produto]) {
    campos.prazo_meses = `O prazo máximo é ${PRAZO_MAX_MESES[produto]} meses.`
  }
  if (Object.keys(campos).length > 0) return validacao(campos)
  const ids = Array.isArray(req.receivable_ids) ? req.receivable_ids : []
  for (const id of ids) {
    const recebivel = e.receivables.find((r) => r.id === id)
    if (!recebivel) {
      return erro(404, 'RECEBIVEL_NAO_ENCONTRADO', `Recebível ${id} não encontrado.`)
    }
    if (recebivel.status !== 'PREVISTO') {
      return erro(422, 'RECEBIVEL_INDISPONIVEL', `Recebível ${id} não está mais disponível.`)
    }
  }
  const m = metricas(e)
  const selecionados = e.receivables.filter((r) => ids.includes(r.id))
  const limite =
    produto === 'ANTECIPACAO_RECEBIVEIS' && ids.length > 0
      ? limiteProduto(produto, {
          recebiveis: soma(selecionados, (r) => r.valor_bruto),
          estoque: m.estoqueValor,
          receitaMensal: m.receitaMensal,
        })
      : m.limites[produto]
  const simulation = simular({
    id: `SIM-${String(e.seq.simulation++).padStart(5, '0')}`,
    produto,
    valor: req.valor as number,
    prazoMeses: prazo as number,
    faixa: faixaDoScore(SCORE_CLIENTE),
    limite,
    hoje: parseIso(e.dia),
  })
  e.simulations.set(simulation.id, { simulation, receivableIds: ids, usada: false })
  return { tipo: 'ok', simulation }
}

export type SolicitarResultado = { tipo: 'ok'; request: PortalCreditRequest } | ErroApi

/** Antecipa primeiro os recebíveis mais distantes (são os que ajudam a atravessar o vale). */
function antecipar(e: Erp, valor: number, ids: number[]) {
  const candidatos = e.receivables
    .filter((r) => r.status === 'PREVISTO' && (ids.length === 0 || ids.includes(r.id)))
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento))
  let coberto = 0
  for (const recebivel of candidatos) {
    if (coberto >= valor) break
    recebivel.status = 'ANTECIPADO'
    coberto += recebivel.valor_bruto * 0.8
  }
}

/** Parcelas do contrato entram nas contas a pagar. */
function lancarParcelas(e: Erp, simulation: Simulation) {
  for (const parcela of simulation.parcelas) {
    e.payables.push({
      id: e.seq.payable++,
      fornecedor: `ErpIa — ${NOME_PRODUTO[simulation.produto]} ${parcela.n}/${simulation.parcelas.length}`,
      categoria: 'EMPRESTIMO',
      vencimento: parcela.vencimento,
      valor: parcela.valor,
      status: 'ABERTO',
      codigo_barras: linhaDigitavel(e.rng),
      pago_em: null,
    })
  }
  e.payables.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id - b.id)
}

export interface SolicitacaoInput {
  simulation_id: string
  produto: ProdutoCredito
  valor: number
  prazo_meses: number
}

const MOTIVOS: Record<PortalCreditRequest['status'], string> = {
  APROVADO: 'Pré-aprovado: crédito liberado na conta.',
  REVISAO: 'Valor acima do limite pré-aprovado: em análise pelo time de crédito.',
  NEGADO: 'Valor acima da capacidade de pagamento estimada.',
  AGUARDANDO_CONTRATACAO: 'Proposta pronta: aguardando quem pode contratar confirmar.',
}

export function solicitarCredito(input: Partial<SolicitacaoInput>): SolicitarResultado {
  const e = erp()
  let registro = input.simulation_id ? e.simulations.get(input.simulation_id) : undefined
  if (input.simulation_id) {
    if (!registro) return erro(404, 'SIMULACAO_NAO_ENCONTRADA', 'Simulação não encontrada.')
    if (registro.usada) {
      return erro(422, 'SIMULACAO_JA_UTILIZADA', 'Esta simulação já virou uma proposta.')
    }
    if (registro.simulation.validade < e.dia) {
      return erro(422, 'SIMULACAO_EXPIRADA', 'Simulação expirada: simule de novo.')
    }
  } else {
    const resultado = simularCredito({
      produto: input.produto,
      valor: input.valor,
      prazo_meses: input.prazo_meses,
    })
    if (resultado.tipo === 'erro') return resultado
    registro = e.simulations.get(resultado.simulation.id)
  }
  const atual = registro as RegistroSimulacao
  atual.usada = true
  const { simulation } = atual
  const aprovacao: PortalCreditRequest['status'] =
    simulation.aprovacao === 'PRE_APROVADO'
      ? 'APROVADO'
      : simulation.aprovacao === 'ANALISE'
        ? 'REVISAO'
        : 'NEGADO'
  // Quem só pode pedir crédito deixa a proposta para quem pode contratar (seção 11).
  const status: PortalCreditRequest['status'] =
    aprovacao === 'APROVADO' && !team.pode('contratar_credito')
      ? 'AGUARDANDO_CONTRATACAO'
      : aprovacao
  const request: PortalCreditRequest = {
    id: e.seq.credit++,
    customerId: CUSTOMER_ID,
    valorSolicitado: simulation.valor_solicitado,
    prazoMeses: simulation.parcelas.length,
    scoreSnapshot: SCORE_CLIENTE,
    status,
    motivo: MOTIVOS[status],
    valorAprovado: status === 'APROVADO' ? simulation.valor_solicitado : null,
    // O DTO usa fração ao mês; a simulação, percentual.
    taxaJuros: status === 'NEGADO' ? null : Math.round(simulation.taxa_mensal * 100) / 10_000,
    criadoEm: new Date().toISOString(),
    createdByNome: team.membroAtual().nome,
  }
  e.creditRequests.push(request)
  if (status === 'APROVADO') {
    lancar(
      e,
      `Crédito liberado — ${NOME_PRODUTO[simulation.produto]}`,
      'CREDIT',
      simulation.valor_liquido,
    )
    if (simulation.produto === 'ANTECIPACAO_RECEBIVEIS') {
      antecipar(e, simulation.valor_solicitado, atual.receivableIds)
    } else lancarParcelas(e, simulation)
  }
  return { tipo: 'ok', request }
}

export function propostas(): PortalCreditRequest[] {
  return [...erp().creditRequests].reverse()
}

// ---------- aprovação de pagamentos (seção 11) ----------

export function pagamentosPendentes(): Payment[] {
  return pagamentos().filter((p) => p.status === 'PENDENTE_APROVACAO')
}

export function decidirPagamento(
  id: number,
  decisao: 'approve' | 'reject',
): { tipo: 'ok'; pagamento: Payment } | ErroApi {
  const e = erp()
  const pagamento = e.payments.find((p) => p.id === id)
  if (!pagamento || pagamento.status !== 'PENDENTE_APROVACAO') {
    return erro(404, 'PAGAMENTO_NAO_ENCONTRADO', 'Não há pagamento pendente com este id.')
  }
  const aprovador = team.membroAtual()
  if (pagamento.created_by_nome === aprovador.nome) {
    return erro(403, 'PROPRIO_AUTOR', 'Quem fez o pagamento não pode aprová-lo.')
  }
  if (decisao === 'reject') {
    pagamento.status = 'REJEITADO'
    pagamento.approved_by = aprovador.nome
    return { tipo: 'ok', pagamento }
  }
  if (!pagamento.agendado_para && pagamento.valor > e.saldo) {
    return erro(422, 'SALDO_INSUFICIENTE', 'Saldo insuficiente.', {
      faltam: r2(pagamento.valor - e.saldo),
    })
  }
  if (pagamento.agendado_para) {
    pagamento.status = 'AGENDADO'
  } else {
    lancar(e, `${pagamento.tipo} — ${pagamento.destinatario}`, 'DEBIT', pagamento.valor)
    pagamento.status = 'EFETIVADO'
  }
  const conta = pagamento.payable_id ? e.payables.find((c) => c.id === pagamento.payable_id) : null
  if (conta) {
    conta.status = pagamento.agendado_para ? 'AGENDADO' : 'PAGO'
    if (!pagamento.agendado_para) conta.pago_em = e.dia
  }
  pagamento.autenticacao = autenticacao(e.rng)
  pagamento.approved_by = aprovador.nome
  return { tipo: 'ok', pagamento }
}
