import { useAuth0 } from '@auth0/auth0-react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { domAnimation, LazyMotion } from 'motion/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { stubIntersectionObserver } from '@/test/intersectionObserver'

import { FinalCta, LandingFooter } from './Closing'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

let state: ReturnType<typeof useAuth0>

beforeEach(() => {
  stubIntersectionObserver()
  state = auth0State({ authenticated: false })
  vi.mocked(useAuth0).mockReturnValue(state)
})

function renderClosing() {
  return render(
    <LazyMotion features={domAnimation} strict>
      <FinalCta />
      <LandingFooter />
    </LazyMotion>,
  )
}

describe('Fechamento da landing', () => {
  it('a faixa final leva ao cadastro e ao login', async () => {
    renderClosing()
    expect(
      screen.getByRole('heading', { level: 2, name: /o que a sua operação diz/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Cadastro em cerca de 3 minutos. Sem cartão de crédito.'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta grátis' }))
    expect(state.loginWithRedirect).toHaveBeenLastCalledWith({
      authorizationParams: { screen_hint: 'signup' },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(vi.mocked(state.loginWithRedirect).mock.lastCall).toEqual([])
  })

  it('o rodapé aponta para as seções e traz o aviso de valores ilustrativos', () => {
    renderClosing()
    const nav = screen.getByRole('navigation', { name: 'Rodapé' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['#cadastro', '#credito', '#banking', '#seguranca'])
    expect(screen.getByRole('link', { name: 'Voltar ao topo' })).toHaveAttribute('href', '#topo')
    expect(screen.getByText(/valores nesta página são ilustrativos/)).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/© 2026/)
  })
})
