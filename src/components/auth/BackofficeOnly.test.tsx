import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { BACKOFFICE_PERMISSIONS } from '@/auth/permissions'
import { auth0State } from '@/test/auth0'

import { BackofficeOnly } from './BackofficeOnly'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<BackofficeOnly />}>
            <Route path="/clientes" element={<p>Clientes do backoffice</p>} />
            <Route path="/perfil" element={<p>Perfil do backoffice</p>} />
          </Route>
          <Route path="/app/*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BackofficeOnly', () => {
  it('empresa cliente vai para o portal (e o perfil, para o perfil do portal)', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
    const { unmount } = renderAt('/clientes')
    expect(await screen.findByTestId('where')).toHaveTextContent('/app')
    unmount()
    renderAt('/perfil')
    expect(await screen.findByTestId('where')).toHaveTextContent('/app/perfil')
  })

  it('a equipe interna segue no backoffice', async () => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: [...BACKOFFICE_PERMISSIONS, 'read:self'] }),
    )
    renderAt('/clientes')
    expect(await screen.findByText('Clientes do backoffice')).toBeInTheDocument()
  })
})
