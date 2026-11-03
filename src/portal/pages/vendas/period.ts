import { dayMonth, isoDay, parseDay } from '../../lib/format'
import type { FormaPagamento, GroupBy, SalesReport } from '../../types'

export type PeriodKey = '7d' | '30d' | '90d' | '120d'

export const PERIODS: { value: PeriodKey; label: string; days: number }[] = [
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: '120d', label: '120d', days: 120 },
]

export const GROUPS: { value: GroupBy; label: string; param: string }[] = [
  { value: 'day', label: 'Dia', param: 'dia' },
  { value: 'week', label: 'Semana', param: 'semana' },
  { value: 'month', label: 'Mês', param: 'mes' },
]

export const DEFAULT_PERIOD: PeriodKey = '30d'

export function periodDays(period: PeriodKey): number {
  return PERIODS.find((p) => p.value === period)!.days
}

/** Agrupamento que faz sentido para o período: até 30 dias por dia, acima disso por semana. */
export function defaultGroup(period: PeriodKey): GroupBy {
  return periodDays(period) >= 90 ? 'week' : 'day'
}

/** Agrupamentos oferecidos: "Mês" só aparece quando o período tem mais de um mês cheio. */
export function groupsFor(period: PeriodKey) {
  return periodDays(period) >= 90 ? GROUPS : GROUPS.filter((g) => g.value !== 'month')
}

/** Lê `?periodo=90d&agrupar=semana`, caindo nos padrões quando o valor é inválido. */
export function readSelection(params: URLSearchParams): { period: PeriodKey; group: GroupBy } {
  const raw = params.get('periodo')
  const period = PERIODS.some((p) => p.value === raw) ? (raw as PeriodKey) : DEFAULT_PERIOD
  const param = params.get('agrupar')
  const group = groupsFor(period).find((g) => g.param === param)?.value ?? defaultGroup(period)
  return { period, group }
}

/** Escreve a seleção na URL omitindo o que já é padrão (URLs curtas e compartilháveis). */
export function writeSelection(
  params: URLSearchParams,
  { period, group }: { period: PeriodKey; group: GroupBy },
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (period === DEFAULT_PERIOD) next.delete('periodo')
  else next.set('periodo', period)
  if (group === defaultGroup(period)) next.delete('agrupar')
  else next.set('agrupar', GROUPS.find((g) => g.value === group)!.param)
  return next
}

export interface SalesWindow {
  from: string
  to: string
}

function shift(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Janela de N dias fechados (até ontem, como o padrão da API) e a janela anterior equivalente,
 * para comparar períodos do mesmo tamanho.
 */
export function windows(
  period: PeriodKey,
  today = new Date(),
): {
  current: SalesWindow
  previous: SalesWindow
} {
  const days = periodDays(period)
  const to = shift(today, -1)
  const from = shift(to, -(days - 1))
  const prevTo = shift(from, -1)
  const prevFrom = shift(prevTo, -(days - 1))
  return {
    current: { from: isoDay(from), to: isoDay(to) },
    previous: { from: isoDay(prevFrom), to: isoDay(prevTo) },
  }
}

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

/** Rótulo curto do eixo: "18 nov", "sem 03/11", "nov/26". */
export function periodLabel(periodo: string, group: GroupBy): string {
  if (group === 'month') {
    const date = parseDay(`${periodo}-01`)
    return `${monthShort.format(date).replace('.', '')}/${String(date.getFullYear()).slice(2)}`
  }
  if (group === 'week') {
    const date = parseDay(periodo)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `sem ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
  }
  return dayMonth(periodo)
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

/** Rótulo por extenso para destaque e tooltip: "sáb, 18 nov", "semana de 03 nov", "novembro de 2026". */
export function periodTitle(periodo: string, group: GroupBy): string {
  if (group === 'month') return monthLong.format(parseDay(`${periodo}-01`))
  if (group === 'week') return `semana de ${dayMonth(periodo)}`
  return `${weekday.format(parseDay(periodo)).replace('.', '')}, ${dayMonth(periodo)}`
}

export interface SalesSummary {
  total: number
  quantidade: number
  ticket: number
  mediaDiaria: number
}

export function summarize(report: SalesReport, days: number): SalesSummary {
  const quantidade = report.serie.reduce((sum, p) => sum + p.quantidade, 0)
  return {
    total: report.total,
    quantidade,
    ticket: report.ticket_medio,
    mediaDiaria: days > 0 ? report.total / days : 0,
  }
}

/** Variação percentual; `null` quando não há base (anterior zerado). */
export function change(current: number, previous: number): number | null {
  if (!(previous > 0)) return null
  return ((current - previous) / previous) * 100
}

/**
 * A janela anterior serve de base só se o histórico a cobre: uma sequência longa de períodos
 * zerados no começo indica que o ERP ainda não tinha dados (cliente novo ou integração recente),
 * e comparar com ela inflaria a variação.
 */
export function comparable(previous: SalesReport | undefined): boolean {
  if (!previous || previous.total <= 0 || previous.serie.length === 0) return false
  const leadingZeros = previous.serie.findIndex((p) => p.valor > 0)
  return leadingZeros / previous.serie.length <= 0.2
}

/** Período de maior faturamento (o primeiro em caso de empate). */
export function bestPeriod(report: SalesReport) {
  return report.serie.reduce<SalesReport['serie'][number] | null>(
    (best, p) => (p.valor > 0 && (!best || p.valor > best.valor) ? p : best),
    null,
  )
}

/** Fatia da receita em sábados e domingos (só faz sentido na série diária). */
export function weekendShare(report: SalesReport): number | null {
  if (report.total <= 0) return null
  const weekend = report.serie
    .filter((p) => [0, 6].includes(parseDay(p.periodo).getDay()))
    .reduce((sum, p) => sum + p.valor, 0)
  return (weekend / report.total) * 100
}

export const FORMA_LABEL: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto',
  DINHEIRO: 'Dinheiro',
}

/** "vs. 30 dias anteriores" */
export function comparisonContext(period: PeriodKey): string {
  return `vs. ${periodDays(period)} dias anteriores`
}
