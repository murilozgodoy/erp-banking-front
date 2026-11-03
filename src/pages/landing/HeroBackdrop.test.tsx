import { act, render } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { animate, useReducedMotion } from 'motion/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { HeroBackdrop } from './HeroBackdrop'

const controls = () => ({ play: vi.fn(), pause: vi.fn(), stop: vi.fn(), time: 0 })

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
  animate: vi.fn(),
}))

type Controls = ReturnType<typeof controls>
const created = () => vi.mocked(animate).mock.results.map((r) => r.value as Controls)

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  stubIntersectionObserver()
  vi.mocked(useReducedMotion).mockReturnValue(false)
  vi.mocked(animate).mockImplementation((() => controls()) as unknown as typeof animate)
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

describe('HeroBackdrop', () => {
  it('é decorativo: aria-hidden, sem ponteiro, quatro faixas e um fio lima', () => {
    const { container } = render(<HeroBackdrop />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveClass('pointer-events-none')
    expect(root.querySelectorAll('svg')).toHaveLength(4)
    expect(root.querySelectorAll('path[data-thread]')).toHaveLength(1)
    // Os gradientes têm id único (useId), para dois heróis na página não colidirem.
    const ids = [...root.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fica parado com "reduzir movimento"', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    const { container } = render(<HeroBackdrop />)
    expect(animate).not.toHaveBeenCalled()
    expect(container.firstElementChild).toHaveAttribute('data-still', 'true')
  })

  it('deriva cada faixa em x e y, defasadas, e pausa com a aba em segundo plano', () => {
    const { unmount } = render(<HeroBackdrop />)
    expect(animate).toHaveBeenCalledTimes(8)
    const all = created()
    expect(all.every((c) => c.play.mock.calls.length > 0)).toBe(true)
    expect(new Set(all.map((c) => c.time)).size).toBeGreaterThan(1)

    setHidden(true)
    expect(all.every((c) => c.pause.mock.calls.length > 0)).toBe(true)

    for (const c of all) c.play.mockClear()
    setHidden(false)
    expect(all.every((c) => c.play.mock.calls.length > 0)).toBe(true)

    unmount()
    expect(all.every((c) => c.stop.mock.calls.length > 0)).toBe(true)
  })
})
