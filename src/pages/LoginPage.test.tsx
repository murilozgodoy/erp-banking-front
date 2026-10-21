import { useAuth0 } from '@auth0/auth0-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { LoginPage } from './LoginPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function renderLogin(returnTo?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: returnTo ? { returnTo } : null }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<p>página de destino</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('entra e cria conta pelo Auth0, voltando para a rota de origem', async () => {
    const state = auth0State({ authenticated: false })
    vi.mocked(useAuth0).mockReturnValue(state)
    renderLogin('/clientes')

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(state.loginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: '/clientes' },
      authorizationParams: undefined,
    })

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(state.loginWithRedirect).toHaveBeenLastCalledWith({
      appState: { returnTo: '/clientes' },
      authorizationParams: { screen_hint: 'signup' },
    })
  })

  it('mostra o erro devolvido pelo Auth0', () => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ authenticated: false, error: new Error('Service not found') }),
    )
    renderLogin()
    expect(screen.getByRole('alert')).toHaveTextContent('Service not found')
  })

  it('redireciona quem já está logado', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State())
    renderLogin('/contas')
    expect(screen.getByText('página de destino')).toBeInTheDocument()
  })

  it('aguarda o carregamento da sessão', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ isLoading: true, authenticated: false }))
    renderLogin()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão')
  })
})
