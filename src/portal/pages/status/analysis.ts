import type { Tone } from '../../ui/Pill'
import type { BusinessAnalysis, FaixaRisco } from '../../types'

export const FAIXA: Record<FaixaRisco, { label: string; tone: Tone }> = {
  BAIXO: { label: 'Risco baixo', tone: 'positive' },
  MEDIO: { label: 'Risco médio', tone: 'warning' },
  ALTO: { label: 'Risco alto', tone: 'negative' },
  MUITO_ALTO: { label: 'Risco muito alto', tone: 'negative' },
}

/** A IA só entra quando a análise saiu de `llm+regras`; o resto é cálculo das regras. */
export function isAiReading(gerado_por: string | null | undefined): boolean {
  return gerado_por === 'llm+regras'
}

/** Score válido (a API manda `null` ou 0 enquanto a análise não terminou). */
export function scoreOf(analysis: Pick<BusinessAnalysis, 'score'> | null | undefined) {
  const score = analysis?.score
  return typeof score === 'number' && score > 0 ? score : null
}

/** Há algo para mostrar além do "em análise" (score, resumo ou listas). */
export function hasReading(analysis: BusinessAnalysis | null | undefined): boolean {
  if (!analysis || analysis.status === 'EM_ANALISE') return false
  return (
    scoreOf(analysis) !== null ||
    Boolean(analysis.resumo?.trim()) ||
    (analysis.pontos_fortes?.length ?? 0) > 0 ||
    (analysis.riscos?.length ?? 0) > 0
  )
}

/** Tempo do momento de confirmação antes de liberar o portal. */
export const CONFIRMACAO_MS = 1_800
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaHora = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "hoje às 14:32" ou "2 de nov. às 14:32". */
export function momento(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (date.toDateString() === now.toDateString()) return `hoje às ${hora.format(date)}`
  return diaHora.format(date).replace(',', ' às')
}
