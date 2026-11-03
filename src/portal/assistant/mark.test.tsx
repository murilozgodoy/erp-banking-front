import { render, screen } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { describe, expect, it, vi } from 'vitest'

import type { Overview } from '../types'
import { AssistantMark } from './AssistantMark'
import { readingSteps, stepsFromAnswer, type Etapa } from './reading'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: () => reduced.value,
}))

const text = (etapa: Etapa) =>
  etapa.trechos.map((trecho) => (typeof trecho === 'string' ? trecho : trecho.forte)).join('')

describe('AssistantMark', () => {
  it.each(['idle', 'thinking', 'done'] as const)('desenha o estado %s', (state) => {
    reduced.value = false
    render(<AssistantMark state={state} size={40} />)
    const mark = screen.getByTestId('assistant-mark')
    expect(mark).toHaveAttribute('data-state', state)
    expect(mark).toHaveAttribute('width', '40')
    expect(mark).not.toHaveAttribute('data-still')
    expect(mark.querySelectorAll('path').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByTestId('assistant-mark-check') !== null).toBe(state === 'done')
  })

  it('fica estático com movimento reduzido', () => {
    reduced.value = true
    render(<AssistantMark state="thinking" />)
    expect(screen.getByTestId('assistant-mark')).toHaveAttribute('data-still', 'true')
    reduced.value = false
  })
})

const OVERVIEW = {
  saldo: 31870,
  receita_30d: 182000,
  ticket_medio_30d: 64,
  recebiveis_90d: 115000,
  a_pagar_30d: 229600,
  estoque_valor: 98000,
  pendencias_count: 15,
} as Overview

describe('card de leitura', () => {
  it('monta até 4 etapas por tela, com os números do overview', () => {
    for (const rota of [
      '/app',
      '/app/vendas',
      '/app/recebiveis',
      '/app/pagamentos',
      '/app/pendencias',
      '/app/estoque',
      '/app/credito',
    ]) {
      const com = readingSteps(rota, OVERVIEW)
      const sem = readingSteps(rota)
      expect(com.length).toBeGreaterThanOrEqual(3)
      expect(com.length).toBeLessThanOrEqual(4)
      expect(sem).toHaveLength(com.length)
      expect(sem.every((etapa) => etapa.trechos.every((t) => typeof t === 'string'))).toBe(true)
    }
    expect(text(readingSteps('/app/recebiveis', OVERVIEW)[0])).toMatch(/^Lendo R\$ 115 mil/)
    expect(text(readingSteps('/app/pendencias', OVERVIEW)[0])).toBe('Lendo 15 pendências')
  })

  it('reconstrói as etapas pelas fontes e acha o valor negativo em destaque', () => {
    const etapas = stepsFromAnswer(
      [
        { tipo: 'overview', label: 'Fluxo de caixa' },
        { tipo: 'recebiveis', label: 'Agenda de recebíveis' },
      ],
      'Seu saldo chega a **-R$ 11.750,00** em 30/11.',
    )
    expect(etapas.map(text)).toEqual([
      'Lendo fluxo de caixa',
      'Lendo agenda de recebíveis',
      'Encontrado: -R$ 11.750,00',
    ])
    expect(etapas[2].atencao).toBe(true)
    expect(stepsFromAnswer([], 'Sem destaque negativo: **R$ 10,00**.')).toEqual([])
  })
})
