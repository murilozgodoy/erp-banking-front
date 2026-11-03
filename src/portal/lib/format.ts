const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** R$ 1.234,56 (ou R$ 1,2 mil com `compact`). */
export function money(value: number, { compact = false } = {}): string {
  return (compact ? brlCompact : brl).format(value)
}

/** Separa reais e centavos para o componente `Money` (centavos com peso menor). */
export function moneyParts(value: number): { sign: string; reais: string; centavos: string } {
  const formatted = brl.format(Math.abs(value)).replace(/\u00a0/g, ' ')
  const [reais, centavos = '00'] = formatted.split(',')
  return { sign: value < 0 ? '−' : '', reais, centavos }
}

export function number(value: number, digits = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 12,4% — `value` já em pontos percentuais. */
export function pct(value: number, digits = 1): string {
  return `${number(value, digits)}%`
}

/** "+12,4%" / "−3,1%" com sinal tipográfico. */
export function signedPct(value: number, digits = 1): string {
  if (value === 0) return pct(0, digits)
  return `${value > 0 ? '+' : '−'}${pct(Math.abs(value), digits)}`
}

/** Datas `YYYY-MM-DD` são lidas como data local (sem deslocar o dia pelo fuso). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const longDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

/** "18 de nov." → "18 nov" */
export function dayMonth(value: string): string {
  // " de " com espaços dos dois lados: "dez" começa com "de" (03 de dez. → 03 dez).
  return shortDate.format(parseDay(value)).replace(/ de /g, ' ').replace(/\./g, '')
}

export function fullDate(value: string): string {
  return longDate.format(parseDay(value))
}

/** Dias inteiros entre hoje e a data (negativo = no passado). */
export function daysFromToday(value: string, today = new Date()): number {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parseDay(value).getTime() - base.getTime()) / 86_400_000)
}

/** "hoje", "amanhã", "em 5 dias", "há 3 dias". */
export function relativeDay(value: string, today = new Date()): string {
  const days = daysFromToday(value, today)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days === -1) return 'ontem'
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`
}

/** Data local `YYYY-MM-DD`. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** CNPJ com 14 dígitos e DVs válidos. */
export function isValidCnpj(value: string): boolean {
  const d = value.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const digit = (base: string) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = [...base].reduce((acc, n, i) => acc + Number(n) * weights[i], 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const first = digit(d.slice(0, 12))
  const second = digit(d.slice(0, 12) + first)
  return d.endsWith(`${first}${second}`)
}

/** Converte o texto digitado ("1.234,56", "R$ 1.234") em número; `null` se vazio. */
export function parseBrlInput(text: string): number | null {
  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
