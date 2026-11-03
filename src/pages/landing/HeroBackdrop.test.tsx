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

  it('deriva, respira e faz o brilho correr em cada faixa, com amplitudes perceptíveis', () => {
    render(<HeroBackdrop />)
    // Quatro faixas x (deriva x, deriva y, respiração, brilho).
    expect(animate).toHaveBeenCalledTimes(16)
    const calls = vi.mocked(animate).mock.calls as unknown[][]
    const byKey = (key: string) =>
      calls.filter((c) => typeof c[1] === 'object' && c[1] !== null && key in c[1])
    const pct = (v: string) => Math.abs(parseFloat(v))
    const layerWidth = 1.2 // a camada sobra 10% de cada lado

    for (const [, keyframes, options] of byKey('x')) {
      const [from, to] = (keyframes as { x: string[] }).x
      // Ida e volta de 8% a 14% do hero.
      const travel = (pct(from) + pct(to)) * layerWidth
      expect(travel).toBeGreaterThanOrEqual(8)
      expect(travel).toBeLessThanOrEqual(14.01)
      const { duration, repeatType, ease } = options as Record<string, unknown>
      expect(duration).toBeGreaterThanOrEqual(14)
      expect(duration).toBeLessThanOrEqual(26)
      expect(repeatType).toBe('mirror')
      expect(ease).toBe('easeInOut')
    }
    for (const [, keyframes, options] of byKey('y')) {
      const [from, to] = (keyframes as { y: string[] }).y
      const travel = pct(from) + pct(to)
      expect(travel).toBeGreaterThanOrEqual(3)
      expect(travel).toBeLessThanOrEqual(6)
      const { duration } = options as { duration: number }
      expect(duration).toBeGreaterThanOrEqual(14)
      expect(duration).toBeLessThanOrEqual(26)
    }
    const breaths = byKey('scaleY')
    expect(breaths).toHaveLength(4)
    for (const [, keyframes] of breaths) {
      const [lo, hi] = (keyframes as { scaleY: number[] }).scaleY
      expect(lo).toBeGreaterThanOrEqual(0.92)
      expect(hi).toBeLessThanOrEqual(1.08)
      expect(lo).toBeLessThan(hi)
    }

    // O brilho anima um número e aplica no gradiente da faixa (e no do fio lima).
    const flows = calls.filter((c) => typeof c[0] === 'number')
    expect(flows).toHaveLength(4)
    const { onUpdate } = flows[1][2] as { onUpdate: (v: number) => void }
    onUpdate(42.123)
    const threadBand = document.querySelectorAll('[aria-hidden] > div')[1]
    const gradients = threadBand.querySelectorAll('linearGradient')
    expect(gradients).toHaveLength(2)
    for (const g of gradients) expect(g).toHaveAttribute('gradientTransform', 'translate(42.1 0)')
  })

  it('defasa as faixas e pausa com a aba em segundo plano', () => {
    const { unmount } = render(<HeroBackdrop />)
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
