import { afterEach, describe, expect, it, vi } from 'vitest'

import { cnpjComDv, cnpjValido } from './analysis'
import { mulberry32 } from './seed'
import { TEMPLATES } from './templates'

const CHAVE = 'erp-portal-mock'

afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.resetModules()
})

describe('cenários', () => {
  it('?mock=aprovado na URL abre o portal aprovado e persiste', async () => {
    window.history.replaceState(null, '', '/app?mock=aprovado')
    const db = await import('./db')
    expect(db.me().onboarding_status).toBe('APROVADO')
    expect(JSON.parse(localStorage.getItem(CHAVE) ?? '{}').status).toBe('APROVADO')
  })

  it('restaura o estado salvo no localStorage', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ status: 'RASCUNHO', respostas: {} }))
    const db = await import('./db')
    expect(db.me().onboarding_status).toBe('RASCUNHO')
  })

  it('ignora localStorage inválido', async () => {
    localStorage.setItem(CHAVE, '{quebrado')
    const db = await import('./db')
    expect(db.me().onboarding_status).toBe('NAO_INICIADO')
  })

  it('setMockStatus troca o cenário', async () => {
    const db = await import('./db')
    db.setMockStatus('RASCUNHO')
    expect(db.rascunho()).toMatchObject({ segmento: 'alimentacao', onboarding_status: 'RASCUNHO' })
    db.setMockStatus('ANALISE_MANUAL')
    expect(db.reviews().map((i) => i.customer_id)).toContain(db.CUSTOMER_ID)
    db.resetMockDb('EM_ANALISE')
    expect(db.me().onboarding_status).toBe('EM_ANALISE')
  })

  it('escala os dados pelo faturamento informado', async () => {
    const db = await import('./db')
    db.salvarOnboarding({
      empresa: db.EMPRESA_AURORA,
      segmento: 'alimentacao',
      respostas: { ...db.RESPOSTAS_AURORA, faturamento_mensal: 364_000 },
      observacoes: '',
      enviar: false,
    })
    expect(db.metricas().receitaMensal).toBeCloseTo(364_000, -2)
    expect(db.fluxoCaixa().some((dia) => dia.saldo_projetado < 0)).toBe(true)
  })
})

describe('utilitários', () => {
  it('sem ofertas na faixa MUITO_ALTO', async () => {
    const db = await import('./db')
    db.resetMockDb('APROVADO')
    expect(db.ofertas('MUITO_ALTO')).toEqual([])
    expect(db.ofertas()).toHaveLength(4)
  })

  it('mulberry32 é determinístico', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('CNPJ com DV válido', () => {
    expect(cnpjComDv('112223330001')).toBe('11222333000181')
    expect(cnpjValido('11222333000181')).toBe(true)
    expect(cnpjValido('11222333000182')).toBe(false)
    expect(cnpjValido('00000000000000')).toBe(false)
  })

  it('validação de tipos dos campos', async () => {
    const db = await import('./db')
    const erros = db.validarOnboarding(db.EMPRESA_AURORA, 'agro', {
      faturamento_mensal: -1,
      safra_principal: 'Soja',
      prazo_medio_recebimento_dias: 30,
      possui_estoque: 'sim' as unknown as boolean,
      margem_bruta_pct: 40,
      dividas_total: 'muito' as unknown as number,
      mes_colheita: 13,
      pct_cartao_credito: 10,
    })
    expect(Object.fromEntries(erros.map((e) => [e.campo, e.erro]))).toEqual({
      faturamento_mensal: 'O valor mínimo é 0.',
      possui_estoque: 'Responda sim ou não.',
      dividas_total: 'Informe um número.',
      mes_colheita: 'Informe um valor entre 1 e 12.',
    })
    expect(db.validarOnboarding(null, null, {}).at(-1)?.campo).toBe('segmento')
    const varejo = db.validarOnboarding(db.EMPRESA_AURORA, 'varejo', {
      ...db.RESPOSTAS_AURORA,
      canais: ['Loja física', 'Teletransporte'],
    })
    expect(varejo).toEqual([{ campo: 'canais', erro: 'Opção inválida.' }])
  })

  it('pct_cartao_credito só nos segmentos combinados', () => {
    const com = TEMPLATES.filter((t) =>
      t.secoes.some((s) => s.campos.some((c) => c.id === 'pct_cartao_credito')),
    ).map((t) => t.segmento)
    expect(com.sort()).toEqual(['alimentacao', 'outro', 'saude', 'servicos', 'varejo'])
  })
})

describe('vale de caixa', () => {
  it('aparece entre o 14º e o 22º dia em qualquer dia da semana', async () => {
    const db = await import('./db')
    for (let dia = 2; dia <= 8; dia++) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 10, dia, 9))
      db.resetMockDb('APROVADO')
      const m = db.metricas()
      expect(m.valeInicio).toBeGreaterThanOrEqual(14)
      expect(m.valeInicio).toBeLessThanOrEqual(22)
      expect(m.valeMinimo).toBeLessThan(-20_000)
      expect(db.fluxoCaixa()[59].saldo_projetado).toBeGreaterThan(0)
    }
    vi.useRealTimers()
  })
})
