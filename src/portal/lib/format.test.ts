import { describe, expect, it } from 'vitest'

import {
  dayMonth,
  daysFromToday,
  formatCnpj,
  fullDate,
  isoDay,
  isValidCnpj,
  money,
  moneyParts,
  number,
  pct,
  relativeDay,
  signedPct,
} from './format'

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ')

describe('format (portal)', () => {
  it('formata BRL inteiro e compacto e separa reais de centavos', () => {
    expect(nbsp(money(1234.5))).toBe('R$ 1.234,50')
    expect(nbsp(money(182000, { compact: true }))).toMatch(/^R\$ 182 mil$/)
    expect(moneyParts(-42.07)).toEqual({ sign: '−', reais: 'R$ 42', centavos: '07' })
    expect(moneyParts(10)).toEqual({ sign: '', reais: 'R$ 10', centavos: '00' })
  })

  it('formata números e percentuais com sinal tipográfico', () => {
    expect(number(1234.567, 2)).toBe('1.234,57')
    expect(pct(12.345)).toBe('12,3%')
    expect(signedPct(4)).toBe('+4,0%')
    expect(signedPct(-3.14)).toBe('−3,1%')
    expect(signedPct(0)).toBe('0,0%')
  })

  it('lê datas YYYY-MM-DD como dia local e escreve datas relativas', () => {
    const today = new Date(2026, 10, 3)
    expect(isoDay(today)).toBe('2026-11-03')
    expect(dayMonth('2026-11-18')).toBe('18 nov')
    expect(fullDate('2026-11-18')).toBe('18 de novembro de 2026')
    expect(daysFromToday('2026-11-08', today)).toBe(5)
    expect(relativeDay('2026-11-03', today)).toBe('hoje')
    expect(relativeDay('2026-11-04', today)).toBe('amanhã')
    expect(relativeDay('2026-11-02', today)).toBe('ontem')
    expect(relativeDay('2026-11-10', today)).toBe('em 7 dias')
    expect(relativeDay('2026-10-30', today)).toBe('há 4 dias')
  })

  it('mascara e valida CNPJ pelos dígitos verificadores', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
    expect(isValidCnpj('123')).toBe(false)
  })
})
