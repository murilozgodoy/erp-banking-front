import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { DashboardPreview } from './DashboardPreview'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

function renderPreview() {
  return render(
    <LazyMotion features={domAnimation} strict>
      <DashboardPreview />
    </LazyMotion>,
  )
}

/** O gráfico tem 600 px de largura no teste: cada 10 px equivalem a 1 dia dos 60. */
function chart() {
  const area = screen.getByTestId('chart-area')
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 180,
  } as DOMRect)
  return area
}

const tooltip = () => screen.getByTestId('chart-tooltip')

beforeEach(() => {
  stubIntersectionObserver()
  vi.mocked(useReducedMotion).mockReturnValue(false)
})

describe('DashboardPreview', () => {
  it('descreve a prévia para leitores de tela e esconde a ilustração', () => {
    const { container } = renderPreview()
    expect(screen.getByText(/caixa projetado que fica negativo em 18 dias/)).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('Padaria Trigo Bom')
  })

  it('os KPIs contam até o valor ao entrar na tela', async () => {
    renderPreview()
    await waitFor(() => expect(screen.getByText('R$ 184.320')).toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(screen.getByText('23,4%')).toBeInTheDocument()
    expect(screen.getByText('34 dias')).toBeInTheDocument()
    expect(screen.getByText('41 dias')).toBeInTheDocument()
  })

  it('com "reduzir movimento", os KPIs já aparecem no valor final', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    renderPreview()
    expect(screen.getByText('R$ 184.320')).toBeInTheDocument()
    expect(screen.getByText('23,4%')).toBeInTheDocument()
  })

  it('mantém os números do caixa de cashflow.ts', () => {
    renderPreview()
    expect(screen.getByText('−R$ 31,8 mil em 21/11')).toBeInTheDocument()
    expect(screen.getByText('+R$ 10,2 mil')).toBeInTheDocument()
    expect(screen.getByText('R$ 38,0 mil')).toBeInTheDocument()
  })

  it('o cursor do gráfico mostra o saldo projetado do dia', () => {
    renderPreview()
    const area = chart()
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()

    fireEvent.pointerMove(area, { clientX: 180 })
    expect(tooltip()).toHaveTextContent('21/11 · em 18 dias')
    expect(tooltip()).toHaveTextContent('−R$ 31,8 mil')

    // Perto do dia 19 a curva suavizada passa um pouco do vale; o tooltip segura no mínimo citado.
    fireEvent.pointerMove(area, { clientX: 190 })
    expect(tooltip()).toHaveTextContent('−R$ 31,8 mil')

    fireEvent.pointerDown(area, { clientX: -40 })
    expect(tooltip()).toHaveTextContent('03/11 · hoje')
    expect(tooltip()).toHaveTextContent('R$ 38,0 mil')

    fireEvent.pointerMove(area, { clientX: 900 })
    expect(tooltip()).toHaveTextContent('02/01 · em 60 dias')
    expect(tooltip()).toHaveTextContent('R$ 63,0 mil')

    fireEvent.pointerLeave(area)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
  })

  it('ignora o ponteiro enquanto o gráfico não tem largura', () => {
    renderPreview()
    fireEvent.pointerMove(screen.getByTestId('chart-area'), { clientX: 100 })
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
  })

  it('passar pelo cartão de crédito destaca o vale que ele cobre', () => {
    const { container } = renderPreview()
    const card = screen.getByTestId('credit-card')
    const dot = () => container.querySelector('span.bg-negative')
    expect(dot()).not.toHaveClass('scale-150')
    fireEvent.pointerEnter(card)
    expect(dot()).toHaveClass('scale-150')
    fireEvent.pointerLeave(card)
    expect(dot()).not.toHaveClass('scale-150')
  })
})
