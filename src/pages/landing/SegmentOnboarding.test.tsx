import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type * as Motion from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { SegmentOnboarding } from './SegmentOnboarding'
import { SEGMENT_CYCLE_MS } from './segments'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const picker = () => screen.getByRole('group', { name: 'Veja o template de um segmento' })
const checked = () => within(picker()).getByRole('radio', { checked: true })

beforeEach(() => {
  stubIntersectionObserver()
  vi.mocked(useReducedMotion).mockReturnValue(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SegmentOnboarding', () => {
  it('mostra as cinco etapas numa timeline com o tempo de cada uma e o total', () => {
    render(<SegmentOnboarding />)
    const steps = within(screen.getByRole('list', { name: 'Etapas do cadastro' })).getAllByRole(
      'listitem',
    )
    expect(steps).toHaveLength(5)
    expect(steps[0]).toHaveTextContent('Dados da empresa')
    expect(steps[0]).toHaveTextContent('CNPJ, nome e contato')
    // O tempo aparece duas vezes: no trilho (desktop) e ao lado do título (celular).
    expect(within(steps[0]).getAllByText('30 s')).toHaveLength(2)
    expect(within(steps[2]).getAllByText('1 min')).toHaveLength(2)
    expect(screen.getByText('Cerca de 3 minutos no total')).toBeInTheDocument()
    expect(screen.getByText('≈ 3 min')).toBeInTheDocument()
  })

  it('a prévia traz perguntas, indicadores e a sugestão de crédito do segmento', () => {
    render(<SegmentOnboarding />)
    expect(within(picker()).getAllByRole('radio')).toHaveLength(8)
    expect(checked()).toHaveAccessibleName('Alimentação')
    expect(screen.getByRole('heading', { name: 'Perguntas para alimentação' })).toBeInTheDocument()
    expect(screen.getByText('Padaria com café')).toBeInTheDocument()
    expect(screen.getByText('O portal destaca')).toBeInTheDocument()
    expect(screen.getByText('Ticket médio por turno')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sugestão da ErpIa' })).toBeInTheDocument()
    expect(screen.getByText('Capital de giro')).toBeInTheDocument()
  })

  it('troca de segmento sozinha a cada ciclo e pausa com o ponteiro em cima', () => {
    vi.useFakeTimers()
    render(<SegmentOnboarding />)
    expect(screen.getByTestId('segmento-progresso')).toBeInTheDocument()

    advance(SEGMENT_CYCLE_MS)
    expect(checked()).toHaveAccessibleName('Serviços')

    const region = picker().parentElement as HTMLElement
    fireEvent.pointerEnter(region)
    advance(SEGMENT_CYCLE_MS * 2)
    expect(checked()).toHaveAccessibleName('Serviços')

    fireEvent.pointerLeave(region)
    advance(SEGMENT_CYCLE_MS)
    expect(checked()).toHaveAccessibleName('Saúde')
  })

  it('o foco também pausa, e o tempo que faltava é retomado ao sair', () => {
    vi.useFakeTimers()
    render(<SegmentOnboarding />)
    advance(SEGMENT_CYCLE_MS - 1000)

    const pause = screen.getByRole('button', { name: 'Pausar troca automática' })
    fireEvent.focusIn(pause)
    advance(SEGMENT_CYCLE_MS * 2)
    expect(checked()).toHaveAccessibleName('Alimentação')

    // Foco que continua dentro do bloco não retoma a troca.
    fireEvent.focusOut(pause, { relatedTarget: checked() })
    advance(SEGMENT_CYCLE_MS)
    expect(checked()).toHaveAccessibleName('Alimentação')

    fireEvent.focusOut(pause, { relatedTarget: document.body })
    advance(1000)
    expect(checked()).toHaveAccessibleName('Serviços')
  })

  it('escolher um segmento para a troca automática e anuncia a prévia', async () => {
    vi.useFakeTimers()
    render(<SegmentOnboarding />)
    const preview = screen.getByRole('heading', { name: 'Perguntas para alimentação' })
      .parentElement?.parentElement?.parentElement as HTMLElement
    expect(preview).toHaveAttribute('aria-live', 'off')

    fireEvent.click(within(picker()).getByRole('radio', { name: 'Saúde' }))
    expect(checked()).toHaveAccessibleName('Saúde')
    expect(screen.queryByTestId('segmento-progresso')).not.toBeInTheDocument()
    expect(preview).toHaveAttribute('aria-live', 'polite')

    advance(SEGMENT_CYCLE_MS * 3)
    expect(checked()).toHaveAccessibleName('Saúde')

    vi.useRealTimers()
    expect(await screen.findByRole('heading', { name: 'Perguntas para saúde' })).toBeInTheDocument()
    expect(screen.getByText('Em quanto tempo os convênios repassam?')).toBeInTheDocument()
  })

  it('o botão pausa e retoma a troca automática', () => {
    vi.useFakeTimers()
    render(<SegmentOnboarding />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar troca automática' }))
    advance(SEGMENT_CYCLE_MS * 2)
    expect(checked()).toHaveAccessibleName('Alimentação')

    fireEvent.click(screen.getByRole('button', { name: 'Retomar troca automática' }))
    advance(SEGMENT_CYCLE_MS)
    expect(checked()).toHaveAccessibleName('Serviços')
  })

  it('mantém a aba ativa à vista quando a barra rola no celular', () => {
    vi.useFakeTimers()
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    const widths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900)
    render(<SegmentOnboarding />)
    expect(scrollTo).not.toHaveBeenCalled()

    advance(SEGMENT_CYCLE_MS)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))

    widths.mockRestore()
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
  })

  it('com "reduzir movimento", não troca sozinho nem mostra o controle de pausa', () => {
    vi.useFakeTimers()
    vi.mocked(useReducedMotion).mockReturnValue(true)
    render(<SegmentOnboarding />)
    expect(screen.queryByRole('button', { name: /troca automática/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('segmento-progresso')).not.toBeInTheDocument()

    advance(SEGMENT_CYCLE_MS * 3)
    expect(checked()).toHaveAccessibleName('Alimentação')

    fireEvent.click(within(picker()).getByRole('radio', { name: 'Agro' }))
    expect(checked()).toHaveAccessibleName('Agro')
  })
})
