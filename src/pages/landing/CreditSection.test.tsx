import { useAuth0 } from '@auth0/auth0-react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as Motion from 'motion/react'
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { CreditSection } from './CreditSection'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: vi.fn(() => false),
}))

let state: ReturnType<typeof useAuth0>

beforeEach(() => {
  stubIntersectionObserver()
  state = auth0State({ authenticated: false })
  vi.mocked(useAuth0).mockReturnValue(state)
  vi.mocked(useReducedMotion).mockReturnValue(false)
})

const renderSection = () =>
  render(
    <LazyMotion features={domAnimation} strict>
      <CreditSection />
    </LazyMotion>,
  )

describe('CreditSection', () => {
  it('lista os 4 produtos como grupo de rádio, cada um com uma linha curta', () => {
    renderSection()
    const grupo = screen.getByRole('group', { name: 'Produto de crédito' })
    const radios = within(grupo).getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(screen.getByRole('radio', { name: 'Capital de giro' })).toBeChecked()

    const estoque = screen.getByRole('radio', { name: 'Financiamento de estoque' })
    expect(estoque).toHaveAccessibleDescription('Quando itens de alto giro ficam abaixo do mínimo')
    expect(screen.queryByText(/Sugerido quando/)).not.toBeInTheDocument()
    // Rótulo curto do controle segmentado do celular.
    expect(within(grupo).getByText('Estoque')).toBeInTheDocument()
  })

  it('troca de produto pelo teclado com as setas', async () => {
    renderSection()
    const capital = screen.getByRole('radio', { name: 'Capital de giro' })
    capital.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Financiamento de estoque' })).toBeChecked()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Simule financiamento de estoque' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1,79% a.m., ilustrativa')).toBeInTheDocument()
  })

  it('mostra onde aparece só o produto selecionado, no cabeçalho do simulador', async () => {
    renderSection()
    expect(screen.getAllByText(/^Aparece em/)).toHaveLength(1)
    expect(screen.getByText('Aparece em Pagamentos e Pendências')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Antecipação de recebíveis' }))
    expect(screen.getByText('Aparece em Vendas e Recebíveis')).toBeInTheDocument()
    expect(screen.queryByText('Aparece em Pagamentos e Pendências')).not.toBeInTheDocument()
  })

  it('desenha uma barra por parcela e acompanha o prazo', () => {
    renderSection()
    expect(screen.getByTestId('parcelas').children).toHaveLength(12)
    expect(screen.getByText('12 parcelas')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '20' } })
    expect(screen.getByTestId('parcelas').children).toHaveLength(20)
    expect(screen.getByText('20 parcelas')).toBeInTheDocument()
    expect(screen.getByLabelText('Prazo')).toHaveAttribute('aria-valuetext', '20 meses')
  })

  it('antecipação compara líquido e bruto numa barra só', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('radio', { name: 'Antecipação de recebíveis' }))
    fireEvent.change(screen.getByLabelText('Valor dos recebíveis'), {
      target: { value: '100000' },
    })
    fireEvent.change(screen.getByLabelText('Prazo até o recebimento'), { target: { value: '3' } })

    expect(screen.getByText('Você recebe hoje')).toBeInTheDocument()
    expect(screen.getByText(/95\.830,00/)).toBeInTheDocument()
    expect(screen.getByText(/4\.170,00/)).toBeInTheDocument()
    const visual = screen.getByTestId('bruto-liquido')
    expect(within(visual).getByText('Líquido sobre o bruto')).toBeInTheDocument()
    expect(within(visual).getByText('96%')).toBeInTheDocument()
    expect(screen.queryByText(/A diferença/)).not.toBeInTheDocument()
  })

  it('a bolha do controle mostra o valor atual', () => {
    renderSection()
    const valor = screen.getByLabelText('Valor')
    fireEvent.change(valor, { target: { value: '250000' } })
    expect(valor).toHaveAttribute('aria-valuetext', expect.stringMatching(/250.000/))
    expect(document.querySelector(`output[for="${valor.id}"]`)).toHaveTextContent(/250.000/)
  })

  it('"Simular com os meus números" abre o cadastro', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: /Simular com os meus números/ }))
    expect(
      screen.getByText('Taxa ilustrativa. Condições reais dependem da análise da sua empresa.'),
    ).toBeInTheDocument()
    expect(state.loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { screen_hint: 'signup' },
    })
  })

  it('com movimento reduzido o número troca direto, sem contar', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    renderSection()
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '100000' } })
    expect(screen.getByText(/9\.566,64/)).toBeInTheDocument()
    expect(screen.getByText('9.566')).toBeInTheDocument()
    expect(screen.getByText(',64')).toBeInTheDocument()
  })
})
