import type { FaixaRisco, Parcela, ProdutoCredito, Simulation } from '../types'

/** Arredonda para centavos. */
export function r2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** Taxa mensal base (%) por faixa; `null` = MUITO_ALTO, crédito negado. */
export const TAXA_BASE: Record<FaixaRisco, number | null> = {
  BAIXO: 1.69,
  MEDIO: 2.49,
  ALTO: 3.49,
  MUITO_ALTO: null,
}

/** Ajuste por produto, em pontos percentuais. */
export const AJUSTE_PRODUTO: Record<ProdutoCredito, number> = {
  ANTECIPACAO_RECEBIVEIS: -0.4,
  FINANCIAMENTO_ESTOQUE: -0.2,
  CAPITAL_DE_GIRO: 0,
  ALAVANCAGEM: 0.3,
  // Consolidação é precificada como capital de giro (e não é ofertada).
  CONSOLIDACAO_DIVIDAS: 0,
}

export const PRAZO_MAX_MESES: Record<ProdutoCredito, number> = {
  ANTECIPACAO_RECEBIVEIS: 6,
  FINANCIAMENTO_ESTOQUE: 18,
  CAPITAL_DE_GIRO: 24,
  ALAVANCAGEM: 36,
  CONSOLIDACAO_DIVIDAS: 24,
}

/** Taxa mensal (%) do produto para a faixa, ou `null` se a faixa nega crédito. */
export function taxaMensal(faixa: FaixaRisco, produto: ProdutoCredito): number | null {
  const base = TAXA_BASE[faixa]
  return base === null ? null : r2(base + AJUSTE_PRODUTO[produto])
}

/** Base de cálculo dos limites por produto. */
export interface BaseLimite {
  /** Soma bruta dos recebíveis selecionados (ou de todos os previstos). */
  recebiveis: number
  /** Valor do estoque a custo. */
  estoque: number
  receitaMensal: number
}

/**
 * Limite por produto (seção 5): antecipação 80% dos recebíveis, financiamento de estoque 60% do
 * estoque, alavancagem 3× a receita. Capital de giro não tem regra no contrato: usamos 1× a receita.
 */
export function limiteProduto(produto: ProdutoCredito, base: BaseLimite): number {
  switch (produto) {
    case 'ANTECIPACAO_RECEBIVEIS':
      return r2(base.recebiveis * 0.8)
    case 'FINANCIAMENTO_ESTOQUE':
      return r2(base.estoque * 0.6)
    case 'ALAVANCAGEM':
      return r2(base.receitaMensal * 3)
    case 'CAPITAL_DE_GIRO':
    case 'CONSOLIDACAO_DIVIDAS':
      return r2(base.receitaMensal)
  }
}

/** Parcela da tabela Price: PV·i / (1 − (1+i)^−n). `taxa` em fração (0,0249). */
export function parcelaPrice(valor: number, taxa: number, n: number): number {
  if (taxa === 0) return valor / n
  return (valor * taxa) / (1 - (1 + taxa) ** -n)
}

function isoDate(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function addMonths(data: Date, meses: number): Date {
  const nova = new Date(data.getFullYear(), data.getMonth() + meses, 1)
  const ultimoDia = new Date(nova.getFullYear(), nova.getMonth() + 1, 0).getDate()
  nova.setDate(Math.min(data.getDate(), ultimoDia))
  return nova
}

function diasEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / 86_400_000)
}

/** Cronograma Price; a última parcela absorve o resíduo de arredondamento. */
export function tabelaPrice(valor: number, taxaPct: number, n: number, inicio: Date): Parcela[] {
  const taxa = taxaPct / 100
  const pmt = r2(parcelaPrice(valor, taxa, n))
  const parcelas: Parcela[] = []
  let saldo = valor
  for (let k = 1; k <= n; k++) {
    const juros = r2(saldo * taxa)
    const amortizacao = k === n ? r2(saldo) : r2(pmt - juros)
    saldo = r2(saldo - amortizacao)
    parcelas.push({
      n: k,
      vencimento: isoDate(addMonths(inicio, k)),
      amortizacao,
      juros,
      valor: r2(amortizacao + juros),
    })
  }
  return parcelas
}

export const IOF_FIXO = 0.0038
export const IOF_DIARIO = 0.000082
export const IOF_DIAS_MAX = 365

/** IOF: 0,38% sobre o total + 0,0082% ao dia sobre cada amortização (até 365 dias). */
export function calcularIof(valor: number, parcelas: Parcela[], inicio: Date): number {
  const diario = parcelas.reduce((total, parcela) => {
    const dias = Math.min(
      diasEntre(inicio, new Date(`${parcela.vencimento}T00:00:00`)),
      IOF_DIAS_MAX,
    )
    return total + parcela.amortizacao * IOF_DIARIO * dias
  }, 0)
  return r2(valor * IOF_FIXO + diario)
}

/** TIR mensal (fração) que iguala o valor líquido ao fluxo de parcelas, por bisseção. */
export function tirMensal(valorLiquido: number, pagamentos: number[]): number {
  const vp = (taxa: number) =>
    pagamentos.reduce((total, pagamento, k) => total + pagamento / (1 + taxa) ** (k + 1), 0)
  let baixo = 0
  let alto = 1
  for (let iteracao = 0; iteracao < 200; iteracao++) {
    const meio = (baixo + alto) / 2
    // VP cai quando a taxa sobe: se ainda está acima do líquido, a taxa é maior.
    if (vp(meio) > valorLiquido) baixo = meio
    else alto = meio
  }
  return (baixo + alto) / 2
}

export interface SimulacaoInput {
  id: string
  produto: ProdutoCredito
  valor: number
  prazoMeses: number
  faixa: FaixaRisco
  limite: number
  hoje: Date
}

/**
 * Simulação completa (seção 5). Aprovação: dentro do limite = PRE_APROVADO; até 1,5× = ANALISE;
 * acima disso ou faixa MUITO_ALTO = NEGADO.
 */
export function simular(input: SimulacaoInput): Simulation {
  const { produto, valor, faixa, hoje } = input
  const prazo = Math.max(1, Math.min(Math.round(input.prazoMeses), PRAZO_MAX_MESES[produto]))
  const taxa = taxaMensal(faixa, produto)
  // MUITO_ALTO: mostramos a conta com a taxa de ALTO, mas a resposta é NEGADO.
  const taxaUsada = taxa ?? (taxaMensal('ALTO', produto) as number)
  const parcelas = tabelaPrice(valor, taxaUsada, prazo, hoje)
  const iof = calcularIof(valor, parcelas, hoje)
  const valorLiquido = r2(valor - iof)
  const cetMensal = tirMensal(
    valorLiquido,
    parcelas.map((parcela) => parcela.valor),
  )
  const limite = taxa === null ? 0 : input.limite
  let aprovacao: Simulation['aprovacao'] = 'NEGADO'
  if (taxa !== null && valor <= limite) aprovacao = 'PRE_APROVADO'
  else if (taxa !== null && valor <= limite * 1.5) aprovacao = 'ANALISE'
  const validade = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7)
  return {
    id: input.id,
    produto,
    valor_solicitado: r2(valor),
    valor_liquido: valorLiquido,
    taxa_mensal: taxaUsada,
    cet_anual: r2(((1 + cetMensal) ** 12 - 1) * 100),
    iof,
    parcelas,
    total_pago: r2(parcelas.reduce((total, parcela) => total + parcela.valor, 0)),
    aprovacao,
    limite_disponivel: limite,
    validade: isoDate(validade),
  }
}
