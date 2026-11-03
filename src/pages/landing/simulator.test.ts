import { describe, expect, it } from 'vitest'

import { clampPrazo, CREDIT_PRODUCTS, parcelaPrice, simular, tabelaPrice } from './simulator'

const produto = (id: string) => CREDIT_PRODUCTS.find((p) => p.id === id)!

describe('simulador ilustrativo', () => {
  it('calcula a parcela pela tabela Price', () => {
    expect(parcelaPrice(80_000, 0.0219, 12)).toBe(7653.32)
    expect(parcelaPrice(100_000, 0.0179, 10)).toBe(11010.69)
    expect(parcelaPrice(50_000, 0.0159, 36)).toBe(1834.82)
  })

  it('sem juros divide o valor igualmente e recusa prazo zero', () => {
    expect(parcelaPrice(12_000, 0, 12)).toBe(1000)
    expect(() => parcelaPrice(12_000, 0.02, 0)).toThrow(RangeError)
  })

  it('parcelado devolve parcela, total e juros coerentes', () => {
    expect(simular(produto('capital-giro'), 80_000, 12)).toEqual({
      modalidade: 'parcelas',
      parcela: 7653.32,
      total: 91839.84,
      juros: 11839.84,
    })
  })

  it('antecipação aplica desconto simples sobre o valor dos recebíveis', () => {
    expect(simular(produto('antecipacao'), 100_000, 3)).toEqual({
      modalidade: 'desconto',
      liquido: 95830,
      custo: 4170,
    })
  })

  it('mantém o prazo dentro da faixa de cada produto', () => {
    expect(clampPrazo(produto('antecipacao'), 24)).toBe(12)
    expect(clampPrazo(produto('alavancagem'), 2)).toBe(6)
    expect(clampPrazo(produto('estoque'), 10)).toBe(10)
  })

  it('decompõe a tabela Price com juros caindo e saldo fechando em zero', () => {
    const linhas = tabelaPrice(80_000, 0.0219, 12)
    expect(linhas).toHaveLength(12)
    expect(linhas[0]).toEqual({ mes: 1, juros: 1752, amortizacao: 5901.32 })
    expect(linhas.every((l, i) => i === 0 || l.juros < linhas[i - 1].juros)).toBe(true)
    const amortizado = linhas.reduce((soma, l) => soma + l.amortizacao, 0)
    expect(Math.round(amortizado * 100) / 100).toBe(80_000)
  })

  it('todo produto tem rótulo curto para o celular', () => {
    for (const p of CREDIT_PRODUCTS) expect(p.rotulo.length).toBeLessThanOrEqual(16)
  })
})
