import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { Can } from './Can'
import { RequireAuth } from './RequireAuth'
import { RequirePermission } from './RequirePermission'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function LoginProbe() {
  const location = useLocation()
  return <p>login, voltar para {(location.state as { returnTo: string }).returnTo}</p>
}

function renderProtected() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/clientes?q=ana']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/clientes" element={<p>conteúdo protegido</p>} />
          </Route>
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RequireAuth', () => {
  it('mostra o conteúdo para usuário logado', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State())
    renderProtected()
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument()
  })

  it('manda para o login guardando a rota de origem', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ authenticated: false }))
    renderProtected()
    expect(screen.getByText('login, voltar para /clientes?q=ana')).toBeInTheDocument()
  })

  it('aguarda o Auth0 carregar a sessão', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ isLoading: true, authenticated: false }))
    renderProtected()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão')
  })
})

describe('Can e RequirePermission', () => {
  it('mostram o conteúdo quando a permissão existe', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['write:customers'] }))
    renderPage(
      <RequirePermission permission="write:customers">
        <Can permission="write:customers">
          <button>Novo cliente</button>
        </Can>
        <Can permission="write:scores" fallback={<p>sem score</p>}>
          <button>Calcular</button>
        </Can>
      </RequirePermission>,
    )

    expect(await screen.findByRole('button', { name: 'Novo cliente' })).toBeInTheDocument()
    expect(screen.getByText('sem score')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Calcular' })).not.toBeInTheDocument()
  })

  it('RequirePermission explica qual permissão falta', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:scores'] }))
    renderPage(
      <RequirePermission permission="read:customers">
        <p>lista</p>
      </RequirePermission>,
    )

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
    expect(screen.getByText('read:customers')).toBeInTheDocument()
    expect(screen.queryByText('lista')).not.toBeInTheDocument()
  })

  it('RequirePermission mostra falha ao obter o token', async () => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ tokenError: Object.assign(new Error('x'), { error: 'login_required' }) }),
    )
    renderPage(
      <RequirePermission permission="read:customers">
        <p>lista</p>
      </RequirePermission>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão expirou')
  })
})
