import { useAuth0 } from '@auth0/auth0-react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { LandingPage } from './LandingPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

let state: ReturnType<typeof useAuth0>

beforeEach(() => {
  stubIntersectionObserver()
  state = auth0State({ authenticated: false })
  vi.mocked(useAuth0).mockReturnValue(state)
})

describe('LandingPage', () => {
  it('apresenta a proposta, a prévia do produto e todas as seções', () => {
    render(<LandingPage />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'O ERP que lê sua operação e encontra o crédito certo.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/caixa projetado que fica negativo em 18 dias/)).toBeInTheDocument()
    for (const name of [
      /cadastro ao portal em 3 minutos/,
      /Crédito em cada tela/,
      /O banco da empresa/,
      /continuam sendo da sua empresa/,
      /o que a sua operação diz/,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(document.title).toContain('ErpIa')
  })

  it('"Criar conta grátis" abre o Auth0 direto no cadastro', async () => {
    render(<LandingPage />)
    const [hero, final] = screen.getAllByRole('button', { name: 'Criar conta grátis' })

    await userEvent.click(hero)
    expect(state.loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { screen_hint: 'signup' },
    })

    await userEvent.click(final)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(state.loginWithRedirect).toHaveBeenCalledTimes(3)
  })

  it('"Entrar" abre o login sem o hint de cadastro', async () => {
    render(<LandingPage />)
    for (const button of screen.getAllByRole('button', { name: 'Entrar' })) {
      await userEvent.click(button)
    }
    expect(state.loginWithRedirect).toHaveBeenCalledTimes(3)
    expect(vi.mocked(state.loginWithRedirect).mock.calls.every((call) => call.length === 0)).toBe(
      true,
    )
  })

  it('o seletor de segmento troca a prévia do onboarding', async () => {
    render(<LandingPage />)
    const picker = screen.getByRole('group', { name: 'Veja o template de um segmento' })
    expect(within(picker).getAllByRole('radio')).toHaveLength(8)
    expect(within(picker).getByRole('radio', { name: 'Alimentação' })).toBeChecked()
    expect(screen.getByRole('heading', { name: 'Perguntas para alimentação' })).toBeInTheDocument()

    await userEvent.click(within(picker).getByRole('radio', { name: 'Saúde' }))
    expect(await screen.findByRole('heading', { name: 'Perguntas para saúde' })).toBeInTheDocument()
    expect(screen.getByText('Em quanto tempo os convênios repassam?')).toBeInTheDocument()
  })

  it('o simulador recalcula a parcela e troca para antecipação', async () => {
    render(<LandingPage />)
    expect(screen.getByText('Parcela mensal estimada')).toBeInTheDocument()
    expect(screen.getByText(/7\.653,32/)).toBeInTheDocument()
    expect(screen.getByText('2,19% a.m., ilustrativa')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '24' } })
    expect(screen.getByLabelText('Prazo')).toHaveAttribute('aria-valuetext', '24 meses')

    await userEvent.click(screen.getByRole('radio', { name: /Antecipação de recebíveis/ }))
    expect(screen.getByText('Você recebe hoje')).toBeInTheDocument()
    // Prazo de 24 meses cai para o máximo da antecipação (12): custo = 100.000 × 1,39% × 12.
    expect(screen.getByLabelText('Prazo até o recebimento')).toHaveAttribute(
      'aria-valuetext',
      '12 meses',
    )
    expect(screen.getByText(/16\.680,00/)).toBeInTheDocument()
    expect(screen.getByText(/83\.320,00/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Prazo até o recebimento'), { target: { value: '1' } })
    expect(screen.getByLabelText('Prazo até o recebimento')).toHaveAttribute(
      'aria-valuetext',
      '1 mês',
    )
  })
})
