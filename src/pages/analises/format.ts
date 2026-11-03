import type { Kpi, Segmento } from '@/portal/types'
import { money, number, pct } from '@/portal/lib/format'

export const SEGMENTO_LABEL: Record<Segmento, string> = {
  varejo: 'Varejo',
  alimentacao: 'Alimentação',
  servicos: 'Serviços',
  saude: 'Saúde',
  tecnologia: 'Tecnologia',
  industria: 'Indústria',
  agro: 'Agro',
  construcao: 'Construção',
  outro: 'Outro',
}

export function segmentoLabel(segmento: string | null | undefined): string {
  if (!segmento) return '—'
  return SEGMENTO_LABEL[segmento as Segmento] ?? segmento
}

export const GERADO_POR_LABEL: Record<string, string> = {
  regras: 'Regras',
  'llm+regras': 'Regras + IA',
}

/** Valor do KPI na unidade dele: BRL, %, dias ou múltiplo. */
export function kpiValue(kpi: Pick<Kpi, 'valor' | 'unidade'>): string {
  switch (kpi.unidade) {
    case 'BRL':
      return money(kpi.valor)
    case 'PCT':
      return pct(kpi.valor)
    case 'DIAS':
      return `${number(kpi.valor)} ${kpi.valor === 1 ? 'dia' : 'dias'}`
    case 'X':
      return `${number(kpi.valor, 1)}×`
    default:
      return number(kpi.valor, Number.isInteger(kpi.valor) ? 0 : 1)
  }
}

/** Tempo de espera na fila: "45 min", "5 h", "2 d 3 h". */
export function waitingTime(fromIso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `${days} d ${rest} h` : `${days} d`
}

/** Mais de 1 dia na fila: passou do prazo que o portal promete ao cliente. */
export function isOverdue(fromIso: string, now = Date.now()): boolean {
  return now - new Date(fromIso).getTime() > 86_400_000
}

const fullDateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function dateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : fullDateTime.format(date)
}

/** "hoje", "ontem", "há 3 dias" a partir de um instante ISO (dia local). */
export function relativeInstant(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(now) - start(date)) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

const MOTIVO_LABEL: Record<string, string> = {
  SEGMENTO_OUTRO: 'Segmento “outro”: fora dos templates',
  LLM_ESPECIFICO: 'A IA classificou o negócio como específico',
  LLM_BAIXA_CONFIANCA: 'A IA ficou com baixa confiança no enquadramento',
}

/**
 * Motivos do envio para a fila, quando a API os mandar (`motivos` ou `motivos_revisao`; o Score
 * já os calcula, mas ainda não os expõe).
 */
export function reviewReasons(analysis: unknown): string[] {
  if (typeof analysis !== 'object' || analysis === null) return []
  const { motivos, motivos_revisao } = analysis as { motivos?: unknown; motivos_revisao?: unknown }
  const raw = Array.isArray(motivos)
    ? motivos
    : Array.isArray(motivos_revisao)
      ? motivos_revisao
      : []
  return raw
    .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
    .map(
      (m) =>
        MOTIVO_LABEL[m] ??
        m
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase()),
    )
}

/** "(41) 93322-1144" a partir dos dígitos; devolve o original se não for um telefone BR. */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return value
}
