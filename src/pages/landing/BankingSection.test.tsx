import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as Motion from 'motion/react'
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { BankingSection } from './BankingSection'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

function renderSection() {
  return render(
    <LazyMotion features={domAnimation} strict>
      <BankingSection />
    </LazyMotion>,
  )
}

const linhas = () =>
  within(screen.getByRole('list', { name: 'Pagamentos da semana' })).getAllByRole('listitem')

const destacadas = () =>
  linhas()
    .filter((li) => li.hasAttribute('data-destaque'))
    .map((li) => li.textContent ?? '')

beforeEach(() => {
  stubIntersectionObserver()
  vi.mocked(useReducedMotion).mockReturnValue(false)
})

describe('BankingSection', () => {
  it('mostra a agenda com o saldo após cada pagamento, negativo na sexta', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 2, name: /O banco da empresa/ })).toBeVisible()
    expect(linhas()).toHaveLength(4)
    const sexta = linhas()[3]
    expect(within(sexta).getByText('Sem saldo')).toBeInTheDocument()
    expect(sexta).toHaveTextContent(/Saldo após: -R\$\s1\.670,00/)
    expect(linhas()[2]).toHaveTextContent(/Saldo após: R\$\s2\.240,00/)
    expect(screen.getByText('Saldo cobre 3 de 4 pagamentos')).toBeInTheDocument()
  })

  it('o capital de giro cobre a sexta, troca o status e a nota da Faísca', async () => {
    renderSection()
    const toggle = screen.getByRole('button', { name: 'Pagar Embalagens Vale com capital de giro' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const sexta = linhas()[3]
    expect(await within(sexta).findByText('Agendado · capital de giro')).toBeInTheDocument()
    expect(sexta).toHaveTextContent(/Saldo após: R\$\s2\.240,00/)
    expect(screen.getByText('Saldo cobre os 4 pagamentos')).toBeInTheDocument()

    await userEvent.click(toggle)
    expect(await within(linhas()[3]).findByText('Sem saldo')).toBeInTheDocument()
  })

  it('passar ou focar um recurso destaca as linhas relacionadas da agenda', () => {
    renderSection()
    const pix = screen.getByRole('button', { name: /^PIX/ })
    const boletos = screen.getByRole('button', { name: /^Boletos/ })
    const agenda = screen.getByRole('button', { name: /^Agenda de pagamentos/ })
    expect(destacadas()).toHaveLength(0)

    fireEvent.mouseEnter(pix)
    expect(destacadas()).toEqual([expect.stringContaining('Folha')])

    fireEvent.mouseEnter(boletos)
    expect(destacadas()).toHaveLength(3)
    expect(destacadas().some((t) => t.includes('Folha'))).toBe(false)

    fireEvent.mouseLeave(boletos.closest('ul') as HTMLElement)
    expect(destacadas()).toHaveLength(0)

    fireEvent.focus(agenda)
    expect(destacadas()).toHaveLength(4)
    fireEvent.blur(agenda)
    expect(destacadas()).toHaveLength(0)
  })

  it('tocar num recurso fixa o destaque até tocar de novo', async () => {
    renderSection()
    const pix = screen.getByRole('button', { name: /^PIX/ })
    await userEvent.click(pix)
    expect(pix).toHaveAttribute('aria-pressed', 'true')
    fireEvent.mouseLeave(pix.closest('ul') as HTMLElement)
    fireEvent.blur(pix)
    expect(destacadas()).toEqual([expect.stringContaining('Folha')])

    await userEvent.click(pix)
    expect(pix).toHaveAttribute('aria-pressed', 'false')
  })

  it('com "reduzir movimento", o saldo de sexta troca sem contar', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    renderSection()
    await userEvent.click(
      screen.getByRole('button', { name: 'Pagar Embalagens Vale com capital de giro' }),
    )
    expect(screen.getAllByText(/^R\$\s2\.240,00$/).length).toBeGreaterThan(0)
  })
})
