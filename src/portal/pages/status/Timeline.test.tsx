import { render, screen } from '@testing-library/react'
import type * as motionReact from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { describe, expect, it, vi } from 'vitest'

import { Timeline } from './Timeline'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof motionReact>()),
  useReducedMotion: vi.fn(() => false),
}))

const steps = [
  { id: 'a', title: 'Recebido', state: 'done' as const },
  { id: 'b', title: 'Análise automática', state: 'current' as const },
  { id: 'c', title: 'Decisão', state: 'pending' as const },
]

describe('Timeline', () => {
  it('pulsa o passo em andamento', () => {
    const { container } = render(<Timeline label="Etapas" steps={steps} />)
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step')
    expect(container.querySelector('[data-pulse]')).toHaveAttribute('data-pulse', 'animated')
  })

  it('fica estático com prefers-reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    const { container } = render(<Timeline label="Etapas" steps={steps} />)
    expect(container.querySelector('[data-pulse]')).toHaveAttribute('data-pulse', 'static')
  })
})
