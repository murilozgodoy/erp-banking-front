import { describe, expect, it } from 'vitest'

import type { SalesReport } from '../../types'

import {
  bestPeriod,
  change,
  comparable,
  defaultGroup,
  groupsFor,
  periodLabel,
  periodTitle,
  readSelection,
  summarize,
  weekendShare,
  windows,
  writeSelection,
} from './period'

function report(serie: (readonly [string, number, number])[]): SalesReport {
  const total = serie.reduce((s, [, v]) => s + v, 0)
  const qtd = serie.reduce((s, [, , q]) => s + q, 0)
  return {
    serie: serie.map(([periodo, valor, quantidade]) => ({ periodo, valor, quantidade })),
    por_forma_pagamento: [],
    por_canal: [],
    top_produtos: [],
    total,
    ticket_medio: qtd ? total / qtd : 0,
  }
}

describe('período de vendas', () => {
  it('janelas fechadas até ontem e a janela anterior do mesmo tamanho', () => {
    const today = new Date(2026, 10, 3)
    expect(windows('7d', today)).toEqual({
      current: { from: '2026-10-27', to: '2026-11-02' },
      previous: { from: '2026-10-20', to: '2026-10-26' },
    })
    expect(windows('30d', today).current).toEqual({ from: '2026-10-04', to: '2026-11-02' })
    expect(windows('120d', today).previous.to).toBe('2026-07-05')
  })

  it('agrupamento padrão, opções e leitura/escrita da URL', () => {
    expect(defaultGroup('30d')).toBe('day')
    expect(defaultGroup('90d')).toBe('week')
    expect(groupsFor('7d').map((g) => g.value)).toEqual(['day', 'week'])
    expect(groupsFor('120d').map((g) => g.value)).toEqual(['day', 'week', 'month'])

    expect(readSelection(new URLSearchParams())).toEqual({ period: '30d', group: 'day' })
    expect(readSelection(new URLSearchParams('periodo=90d'))).toEqual({
      period: '90d',
      group: 'week',
    })
    expect(readSelection(new URLSearchParams('periodo=120d&agrupar=mes'))).toEqual({
      period: '120d',
      group: 'month',
    })
    // Valores inválidos ou sem sentido para o período caem no padrão.
    expect(readSelection(new URLSearchParams('periodo=1y&agrupar=mes'))).toEqual({
      period: '30d',
      group: 'day',
    })

    const base = new URLSearchParams('outro=1&periodo=7d')
    expect(writeSelection(base, { period: '30d', group: 'day' }).toString()).toBe('outro=1')
    expect(writeSelection(base, { period: '90d', group: 'day' }).toString()).toBe(
      'outro=1&periodo=90d&agrupar=dia',
    )
  })

  it('rótulos de dia, semana e mês', () => {
    expect(periodLabel('2026-11-18', 'day')).toBe('18 nov')
    expect(periodLabel('2026-11-02', 'week')).toBe('sem 02/11')
    expect(periodLabel('2026-11', 'month')).toBe('nov/26')
    expect(periodTitle('2026-11-21', 'day')).toBe('sáb, 21 nov')
    expect(periodTitle('2026-11-02', 'week')).toBe('semana de 02 nov')
    expect(periodTitle('2026-11', 'month')).toBe('novembro de 2026')
  })

  it('resumo, variação, melhor período e fim de semana', () => {
    const r = report([
      ['2026-11-20', 100, 2],
      ['2026-11-21', 300, 5],
      ['2026-11-22', 100, 3],
    ])
    expect(summarize(r, 2)).toEqual({ total: 500, quantidade: 10, ticket: 50, mediaDiaria: 250 })
    expect(summarize(r, 0).mediaDiaria).toBe(0)
    expect(bestPeriod(r)?.periodo).toBe('2026-11-21')
    expect(bestPeriod(report([['2026-11-20', 0, 0]]))).toBeNull()
    expect(weekendShare(r)).toBe(80)
    expect(weekendShare(report([]))).toBeNull()
    expect(change(120, 100)).toBeCloseTo(20)
    expect(change(5, 0)).toBeNull()
  })

  it('só compara com uma janela anterior coberta pelo histórico', () => {
    expect(comparable(undefined)).toBe(false)
    expect(comparable(report([['2026-11-01', 0, 0]]))).toBe(false)
    const zeros = Array.from({ length: 6 }, (_, i) => [`2026-10-0${i + 1}`, 0, 0] as const)
    expect(comparable(report([...zeros, ['2026-10-07', 10, 1], ['2026-10-08', 10, 1]]))).toBe(false)
    expect(
      comparable(
        report([
          ['2026-10-07', 0, 0],
          ['2026-10-08', 10, 1],
          ['2026-10-09', 0, 0],
          ['2026-10-10', 10, 1],
          ['2026-10-11', 10, 1],
        ]),
      ),
    ).toBe(true)
  })
})
