const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(value: number): string {
  return currency.format(value)
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return `${formatNumber(value, fractionDigits)}%`
}

/**
 * As APIs Python devolvem datas em UTC sem fuso ("2026-10-21T15:00:00"); a API Java
 * devolve com "Z". Sem o ajuste, o navegador leria as primeiras como horário local.
 */
export function parseApiDate(value: string): Date {
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  return new Date(hasTimezone ? value : `${value}Z`)
}

export function formatDateTime(value: string): string {
  return parseApiDate(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDate(value: string): string {
  return parseApiDate(value).toLocaleDateString('pt-BR')
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCpf(cpf: string): string {
  const digits = onlyDigits(cpf)
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf
}

/** "comprometimento_alto" -> "Comprometimento alto" (nomes dos fatores de score). */
export function humanize(name: string): string {
  const text = name.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
