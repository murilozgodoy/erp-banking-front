import { describe, expect, it } from 'vitest'

import {
  calcularIof,
  limiteProduto,
  parcelaPrice,
  simular,
  tabelaPrice,
  taxaMensal,
  tirMensal,
} from './pricing'

const HOJE = new Date(2026, 10, 3)

describe('taxaMensal', () => {
  it('aplica a taxa da faixa e o ajuste do produto', () => {
    expect(taxaMensal('MEDIO', 'CAPITAL_DE_GIRO')).toBe(2.49)
    expect(taxaMensal('MEDIO', 'ANTECIPACAO_RECEBIVEIS')).toBe(2.09)
    expect(taxaMensal('BAIXO', 'FINANCIAMENTO_ESTOQUE')).toBe(1.49)
    expect(taxaMensal('ALTO', 'ALAVANCAGEM')).toBe(3.79)
    expect(taxaMensal('MUITO_ALTO', 'CAPITAL_DE_GIRO')).toBeNull()
  })
})

describe('limiteProduto', () => {
  const base = { recebiveis: 100_000, estoque: 50_000, receitaMensal: 182_000 }
  it('segue as regras da seção 5', () => {
    expect(limiteProduto('ANTECIPACAO_RECEBIVEIS', base)).toBe(80_000)
    expect(limiteProduto('FINANCIAMENTO_ESTOQUE', base)).toBe(30_000)
    expect(limiteProduto('ALAVANCAGEM', base)).toBe(546_000)
    expect(limiteProduto('CAPITAL_DE_GIRO', base)).toBe(182_000)
    expect(limiteProduto('CONSOLIDACAO_DIVIDAS', base)).toBe(182_000)
  })
})

describe('tabela Price', () => {
  it('calcula a parcela fixa', () => {
    // 10.000 a 2% em 12 meses = 945,60
    expect(parcelaPrice(10_000, 0.02, 12)).toBeCloseTo(945.6, 2)
    expect(parcelaPrice(1_200, 0, 12)).toBe(100)
  })

  it('amortiza todo o valor com parcelas iguais e juros decrescentes', () => {
    const parcelas = tabelaPrice(10_000, 2, 12, HOJE)
    const amortizado = parcelas.reduce((total, p) => total + p.amortizacao, 0)
    expect(amortizado).toBeCloseTo(10_000, 2)
    expect(parcelas[0]).toMatchObject({ n: 1, vencimento: '2026-12-03', juros: 200, valor: 945.6 })
    expect(parcelas[11].vencimento).toBe('2027-11-03')
    expect(Math.abs(parcelas[11].valor - 945.6)).toBeLessThan(0.1)
    expect(parcelas[11].juros).toBeLessThan(parcelas[0].juros)
  })

  it('ajusta o dia no fim do mês', () => {
    const parcelas = tabelaPrice(1_000, 2, 1, new Date(2026, 0, 31))
    expect(parcelas[0].vencimento).toBe('2026-02-28')
  })
})

describe('IOF', () => {
  it('cobra 0,38% + 0,0082% ao dia', () => {
    const parcelas = tabelaPrice(10_000, 2, 1, HOJE)
    // 30 dias: 38 + 10.000 × 0,000082 × 30 = 62,60
    expect(calcularIof(10_000, parcelas, HOJE)).toBe(62.6)
  })

  it('limita a parte diária a 365 dias', () => {
    const longo = [{ n: 1, vencimento: '2028-11-03', amortizacao: 10_000, juros: 0, valor: 10_000 }]
    expect(calcularIof(10_000, longo, HOJE)).toBeCloseTo(38 + 10_000 * 0.000082 * 365, 2)
  })
})

describe('simular', () => {
  const entrada = {
    id: 'SIM-1',
    produto: 'CAPITAL_DE_GIRO' as const,
    valor: 50_000,
    prazoMeses: 12,
    faixa: 'MEDIO' as const,
    limite: 100_000,
    hoje: HOJE,
  }

  it('tem CET acima da taxa nominal (IOF incluso)', () => {
    const sim = simular(entrada)
    const taxaAnual = ((1 + 0.0249) ** 12 - 1) * 100
    expect(sim.taxa_mensal).toBe(2.49)
    expect(sim.cet_anual).toBeGreaterThan(taxaAnual)
    expect(sim.valor_liquido).toBeCloseTo(50_000 - sim.iof, 2)
    expect(sim.total_pago).toBeGreaterThan(50_000)
    expect(sim.parcelas).toHaveLength(12)
    expect(sim.validade).toBe('2026-11-10')
    expect(sim.aprovacao).toBe('PRE_APROVADO')
  })

  it('manda para análise até 1,5× o limite e nega acima', () => {
    expect(simular({ ...entrada, valor: 140_000 }).aprovacao).toBe('ANALISE')
    expect(simular({ ...entrada, valor: 160_000 }).aprovacao).toBe('NEGADO')
  })

  it('nega MUITO_ALTO e limita o prazo do produto', () => {
    const sim = simular({
      ...entrada,
      faixa: 'MUITO_ALTO',
      produto: 'ANTECIPACAO_RECEBIVEIS',
      prazoMeses: 10,
    })
    expect(sim.aprovacao).toBe('NEGADO')
    expect(sim.limite_disponivel).toBe(0)
    expect(sim.parcelas).toHaveLength(6)
  })

  it('TIR por bisseção recupera a taxa da Price', () => {
    const pmt = parcelaPrice(10_000, 0.03, 6)
    expect(tirMensal(10_000, Array(6).fill(pmt))).toBeCloseTo(0.03, 6)
  })
})
