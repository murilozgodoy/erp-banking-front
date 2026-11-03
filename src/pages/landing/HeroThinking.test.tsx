import { act, fireEvent, render, screen } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { HERO_THINKING_LABEL, HeroThinking } from './HeroThinking'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

function renderPanel() {
  return render(
    <LazyMotion features={domAnimation} strict>
      <HeroThinking />
    </LazyMotion>,
  )
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  stubIntersectionObserver()
})

describe('HeroThinking com "reduzir movimento"', () => {
  beforeEach(() => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
  })

  it('mostra a conclusão parada, com o resumo acessível e nada focável', () => {
    const { container } = renderPanel()
    const panel = screen.getByRole('img', { name: HERO_THINKING_LABEL })
    expect(panel).toHaveAccessibleName(/vale de R\$ 31,8 mil no dia 18/)
    expect(panel).toHaveAccessibleName(/antecipar R\$ 42 mil/)

    for (const text of [
      'Projetando o caixa dos próximos 60 dias',
      'Antecipar R$ 42 mil cobre o vale',
      '1,29% a.m. · 3 parcelas',
      'Pré-aprovado',
      'Conclusão',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    // Os contadores já estão no valor final (o fantasma que reserva a largura e o visível).
    expect(screen.getAllByText('2.980')).toHaveLength(2)
    expect(screen.getAllByText('4.885')).toHaveLength(2)
    expect(screen.getAllByText('31,8')).toHaveLength(2)

    expect(screen.getByText('Leitura concluída')).toHaveStyle({ opacity: '1' })
    expect(screen.getByText('Lendo a operação')).toHaveStyle({ opacity: '0' })
    expect(screen.getByText('dia 18')).not.toHaveClass('text-negative')
    expect(container.querySelector('path.stroke-accent[fill="none"]')).not.toBeNull()
    expect(container.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
  })
})

describe('HeroThinking animado', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(useReducedMotion).mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('conta a história, conclui, pausa com o ponteiro em cima e recomeça', () => {
    const { container } = renderPanel()
    const curve = () => container.querySelector('path[fill="none"][stroke-width="2.25"]')
    const panel = screen.getByRole('img', { name: HERO_THINKING_LABEL })

    expect(curve()).toHaveClass('stroke-ink-muted')
    expect(screen.getByText('dia 18')).not.toHaveClass('text-negative')

    advance(5200)
    expect(screen.getByText('dia 18')).toHaveClass('text-negative')
    expect(curve()).toHaveClass('stroke-ink-muted')

    advance(2200)
    expect(screen.getByText('dia 18')).not.toHaveClass('text-negative')
    expect(curve()).toHaveClass('stroke-accent')

    // Com o ponteiro em cima, o roteiro para: a conclusão continua na tela.
    fireEvent.pointerEnter(panel)
    advance(8000)
    expect(curve()).toHaveClass('stroke-accent')

    // Sem o ponteiro, segue até o fim do ciclo e recomeça do zero.
    fireEvent.pointerLeave(panel)
    advance(5500)
    expect(curve()).toHaveClass('stroke-ink-muted')
  })
})
