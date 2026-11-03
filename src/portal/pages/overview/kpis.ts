import { money, number, pct } from '../../lib/format'
import type { Tone } from '../../ui/Pill'
import type { FaixaRisco, Kpi, KpiId } from '../../types'

/** Faixas do score 0–1000 (mesmos cortes da Credit Score API), da pior para a melhor. */
export const FAIXAS: {
  faixa: FaixaRisco
  label: string
  from: number
  to: number
  tone: Tone
  bar: string
}[] = [
  {
    faixa: 'MUITO_ALTO',
    label: 'Risco muito alto',
    from: 0,
    to: 400,
    tone: 'negative',
    bar: 'bg-negative',
  },
  { faixa: 'ALTO', label: 'Risco alto', from: 400, to: 600, tone: 'warning', bar: 'bg-warning' },
  { faixa: 'MEDIO', label: 'Risco médio', from: 600, to: 800, tone: 'info', bar: 'bg-info' },
  {
    faixa: 'BAIXO',
    label: 'Risco baixo',
    from: 800,
    to: 1000,
    tone: 'positive',
    bar: 'bg-positive',
  },
]

/** KPIs em que um valor menor que o do segmento é melhor. */
export const LOWER_IS_BETTER = new Set<KpiId>([
  'prazo_medio_recebimento_dias',
  'ciclo_caixa_dias',
  'endividamento_sobre_receita',
  'comprometimento_parcelas_pct',
  'cobertura_estoque_dias',
])

export const KNOWN_KPIS = new Set<string>([
  ...LOWER_IS_BETTER,
  'receita_mensal',
  'margem_bruta_pct',
  'ticket_medio',
  'prazo_medio_pagamento_dias',
])

/** Valor de um KPI na unidade do contrato (BRL, PCT, DIAS, X). */
export function formatKpi(valor: number, unidade: Kpi['unidade']): string {
  switch (unidade) {
    case 'BRL':
      return money(valor, { compact: Math.abs(valor) >= 100_000 })
    case 'PCT':
      return pct(valor, 1)
    case 'DIAS':
      return `${number(valor)} ${Math.abs(valor) === 1 ? 'dia' : 'dias'}`
    case 'X':
      return `${number(valor, 2)}×`
    default:
      return number(valor, 2)
  }
}

/** Diferença relativa ao segmento, em %; `null` sem benchmark comparável. */
export function benchmarkDiff(kpi: Kpi): number | null {
  if (kpi.benchmark_segmento === null || kpi.benchmark_segmento === 0) return null
  return ((kpi.valor - kpi.benchmark_segmento) / Math.abs(kpi.benchmark_segmento)) * 100
}
