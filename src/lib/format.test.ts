import { describe, expect, it } from 'vitest'

import {
  formatCpf,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  humanize,
  onlyDigits,
  parseApiDate,
} from './format'

describe('format', () => {
  it('moeda, números e percentuais em pt-BR', () => {
    expect(formatCurrency(1234.5)).toBe('R$ 1.234,50')
    expect(formatNumber(812.456, 1)).toBe('812,5')
    expect(formatNumber(1000)).toBe('1.000')
    expect(formatPercent(2.99)).toBe('2,99%')
  })

  it('datas sem fuso das APIs Python são lidas como UTC', () => {
    expect(parseApiDate('2026-10-21T15:00:00').toISOString()).toBe('2026-10-21T15:00:00.000Z')
    expect(parseApiDate('2026-10-21T15:00:00Z').toISOString()).toBe('2026-10-21T15:00:00.000Z')
    expect(parseApiDate('2026-10-21T12:00:00-03:00').toISOString()).toBe('2026-10-21T15:00:00.000Z')
    const utc = new Date(Date.UTC(2026, 9, 21, 15))
    expect(formatDateTime('2026-10-21T15:00:00')).toBe(
      utc.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    )
    expect(formatDate('2026-10-21T15:00:00')).toBe(utc.toLocaleDateString('pt-BR'))
  })

  it('CPF e textos', () => {
    expect(onlyDigits('123.456.789-00')).toBe('12345678900')
    expect(formatCpf('12345678900')).toBe('123.456.789-00')
    expect(formatCpf('123')).toBe('123')
    expect(humanize('comprometimento_alto')).toBe('Comprometimento alto')
  })
})
