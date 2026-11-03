import { describe, expect, it } from 'vitest'

import type { InventoryMovement } from '../../types'

import {
  custoMedio,
  erroQuantidade,
  parseQuantidade,
  quandoFoi,
  quantidadeAssinada,
  saldoFinal,
  situacaoMinimo,
} from './movement'

function movimento(overrides: Partial<InventoryMovement>): InventoryMovement {
  return {
    id: 1,
    item_id: 1,
    tipo: 'ENTRADA',
    quantidade: 18,
    quantidade_anterior: 12,
    quantidade_final: 30,
    custo_unitario: null,
    motivo: null,
    created_by_nome: null,
    created_at: '2026-11-03T12:00:00Z',
    ...overrides,
  }
}

describe('regras da movimentação', () => {
  it('saldo final por tipo: entrada soma, saída subtrai, ajuste é o contado', () => {
    expect(saldoFinal('ENTRADA', 12, 18)).toBe(30)
    expect(saldoFinal('SAIDA', 12, 5)).toBe(7)
    expect(saldoFinal('AJUSTE', 12, 30)).toBe(30)
    expect(saldoFinal('AJUSTE', 12, 0)).toBe(0)
  })

  it('custo médio ponderado da entrada com custo', () => {
    // 12 a R$ 10 + 18 a R$ 15 = 30 a R$ 13
    expect(custoMedio(12, 10, 18, 15)).toBe(13)
    expect(custoMedio(76, 27, 200, 30)).toBe(29.17)
    expect(custoMedio(0, 10, 5, 8)).toBe(8)
    expect(custoMedio(0, 10, 0, 8)).toBe(10)
  })

  it('valida a quantidade como o back', () => {
    expect(erroQuantidade('ENTRADA', null, 10)).toBe('Informe a quantidade.')
    expect(erroQuantidade('AJUSTE', null, 10)).toBe('Informe quanto foi contado.')
    expect(erroQuantidade('ENTRADA', 0, 10)).toBe('Informe uma quantidade maior que zero.')
    expect(erroQuantidade('AJUSTE', 0, 10)).toBeNull()
    expect(erroQuantidade('ENTRADA', 1_000_001, 10)).toMatch(/no máximo/)
    expect(erroQuantidade('SAIDA', 11, 10)).toBe('Disponível: 10 un.')
    expect(erroQuantidade('SAIDA', 10, 10)).toBeNull()
  })

  it('lê só inteiros', () => {
    expect(parseQuantidade('18')).toBe(18)
    expect(parseQuantidade('1.200')).toBe(1200)
    expect(parseQuantidade('')).toBeNull()
    expect(parseQuantidade('2,5')).toBeNull()
  })

  it('situação frente ao mínimo', () => {
    expect(situacaoMinimo(14, 15)).toBe('abaixo')
    expect(situacaoMinimo(15, 15)).toBe('no-minimo')
    expect(situacaoMinimo(16, 15)).toBe('acima')
  })

  it('quantidade com sinal e data relativa no histórico', () => {
    expect(quantidadeAssinada(movimento({}))).toBe('+18')
    expect(quantidadeAssinada(movimento({ tipo: 'SAIDA', quantidade: 5 }))).toBe('−5')
    expect(quantidadeAssinada(movimento({ tipo: 'AJUSTE', quantidade_final: 30 }))).toBe(
      'ajuste para 30',
    )
    const agora = new Date(2026, 10, 3, 15, 0)
    expect(quandoFoi(new Date(2026, 10, 3, 9, 5).toISOString(), agora)).toBe('hoje às 09:05')
    expect(quandoFoi(new Date(2026, 10, 2, 18, 30).toISOString(), agora)).toBe('ontem às 18:30')
    expect(quandoFoi(new Date(2026, 9, 28, 10, 0).toISOString(), agora)).toBe('há 6 dias')
  })
})
