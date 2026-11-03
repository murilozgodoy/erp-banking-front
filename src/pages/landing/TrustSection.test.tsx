import { act, fireEvent, render, screen } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrustSection } from './TrustSection'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

/** IntersectionObserver controlado pelo teste: nada fica visível até `show(el)`. */
const observed = new Map<Element, IntersectionObserverCallback>()
function stubObserver() {
  observed.clear()
  class Stub {
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe = (target: Element) => {
      observed.set(target, this.callback)
    }
    unobserve = () => {}
    disconnect = () => {}
    takeRecords = () => []
  }
  vi.stubGlobal('IntersectionObserver', Stub)
}
function show(el: Element) {
  const callback = observed.get(el)
  act(() => {
    callback?.(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })
}

function stubDesktop(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

function renderSection() {
  return render(
    <LazyMotion features={domAnimation} strict>
      <TrustSection />
    </LazyMotion>,
  )
}

const steps = () => screen.getAllByRole('listitem').filter((li) => li.tabIndex === 0)
const progress = () => screen.getByTestId('flow-progress')

beforeEach(() => {
  stubObserver()
  vi.mocked(useReducedMotion).mockReturnValue(false)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TrustSection', () => {
  it('apresenta as quatro etapas do caminho dos dados, em ordem', () => {
    renderSection()
    expect(
      screen.getByRole('heading', { level: 2, name: /continuam sendo da sua empresa/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Login pelo Auth0',
      'Dados separados por empresa',
      'LGPD',
      'Análise com revisão humana',
    ])
    expect(
      screen.getByText(/uma pessoa da equipe revisa antes de qualquer decisão/),
    ).toBeInTheDocument()
    expect(screen.getByText(/não recebe nem guarda a sua senha/)).toBeInTheDocument()
    expect(screen.getByText('O caminho de um dado')).toBeInTheDocument()
  })

  it('no celular, cada etapa acende ao entrar na tela e o diagrama acompanha', () => {
    renderSection()
    expect(steps().every((li) => li.dataset.active === 'false')).toBe(true)
    expect(progress()).toHaveStyle({ transform: 'scaleX(0)' })

    show(steps()[0])
    expect(steps()[0]).toHaveAttribute('aria-current', 'step')
    expect(progress()).toHaveStyle({ transform: 'scaleX(0.25)' })

    show(steps()[2])
    expect(steps().map((li) => li.dataset.active)).toEqual(['true', 'true', 'true', 'false'])
    expect(steps()[2]).toHaveAttribute('aria-current', 'step')
    expect(progress()).toHaveStyle({ transform: 'scaleX(0.75)' })

    // Voltar a uma etapa anterior não apaga as que já passaram.
    show(steps()[1])
    expect(steps()[2]).toHaveAttribute('aria-current', 'step')
  })

  it('com "reduzir movimento", tudo já aparece aceso e parado', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    renderSection()
    expect(steps().every((li) => li.dataset.active === 'true')).toBe(true)
    expect(steps()[3]).toHaveAttribute('aria-current', 'step')
    expect(progress()).toHaveStyle({ transform: 'scaleX(1)' })
  })

  it('no desktop, o scroll é quem acende: entrar na tela não basta', () => {
    stubDesktop(true)
    renderSection()
    show(steps()[0])
    show(steps()[1])
    expect(steps().every((li) => li.dataset.active === 'false')).toBe(true)
  })

  it('focar uma etapa pelo teclado rola até ela e a realça', () => {
    renderSection()
    const lgpd = steps()[2]
    const title = screen.getByRole('heading', { level: 3, name: 'LGPD' })
    expect(title).toHaveClass('text-ink-faint')

    fireEvent.focus(lgpd)
    expect(lgpd.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(title).toHaveClass('text-ink')

    fireEvent.blur(lgpd)
    expect(title).toHaveClass('text-ink-faint')

    fireEvent.pointerEnter(lgpd)
    expect(title).toHaveClass('text-ink')
    fireEvent.pointerLeave(lgpd)
    expect(title).toHaveClass('text-ink-faint')
  })
})
