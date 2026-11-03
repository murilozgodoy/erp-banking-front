import { describe, expect, it } from 'vitest'

import { formatDuration, ONBOARDING_STEPS, SEGMENTS, totalMinutes } from './segments'

describe('segments', () => {
  it('formata a duração das etapas', () => {
    expect(formatDuration(10)).toBe('10 s')
    expect(formatDuration(60)).toBe('1 min')
    expect(formatDuration(90)).toBe('1 min 30 s')
  })

  it('as etapas somam cerca de 3 minutos', () => {
    expect(totalMinutes()).toBe(3)
    expect(totalMinutes(ONBOARDING_STEPS)).toBe(3)
    expect(totalMinutes([{ etapa: 'x', detalhe: 'y', segundos: 5 }])).toBe(1)
  })

  it('todo segmento tem id único, três perguntas e uma sugestão de crédito', () => {
    expect(new Set(SEGMENTS.map((s) => s.id)).size).toBe(SEGMENTS.length)
    for (const segment of SEGMENTS) {
      expect(segment.perguntas).toHaveLength(3)
      expect(segment.indicadores.length).toBeGreaterThan(0)
      expect(segment.credito.produto).not.toBe('')
    }
  })
})
