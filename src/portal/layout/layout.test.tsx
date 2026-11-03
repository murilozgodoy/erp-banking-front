import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { BACKOFFICE_PERMISSIONS } from '@/auth/permissions'
import { LandingGate } from '@/pages/landing/LandingGate'
import { auth0State } from '@/test/auth0'

import { useMockApi } from '../test/portal'
import { FocusLayout } from './FocusLayout'
import { PortalGate } from './PortalGate'
import { portalHome } from './routing'
import { PortalLayout } from './PortalLayout'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

function renderApp(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/" element={<LandingGate />} />
          <Route path="/app" element={<PortalGate />}>
            <Route element={<FocusLayout />}>
              <Route path="onboarding" element={<Where />} />
              <Route path="status" element={<Where />} />
            </Route>
            <Route element={<PortalLayout />}>
              <Route index element={<Where />} />
              <Route path="vendas" element={<Where />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const cliente = () => auth0State({ permissions: ['read:self', 'write:self'] })

describe('portal: porta, shell e roteamento', () => {
  describe('cliente ainda sem cadastro', () => {
    useMockApi('NAO_INICIADO')

    it('vai para o onboarding, com o layout enxuto', async () => {
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/app/vendas')
      expect(await screen.findByTestId('where')).toHaveTextContent('/app/onboarding')
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    })
  })

  describe('cliente em análise', () => {
    useMockApi('EM_ANALISE')

    it('só vê a página de status', async () => {
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/app')
      expect(await screen.findByTestId('where')).toHaveTextContent('/app/status')
    })
  })

  describe('cliente aprovado', () => {
    const server = useMockApi('APROVADO')

    it('abre o portal com rail, saldo e pendências; onboarding redireciona', async () => {
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/app/onboarding')
      expect(await screen.findByTestId('where')).toHaveTextContent('/app')
      expect(screen.getAllByRole('link', { name: 'Vendas' }).length).toBeGreaterThan(0)
      expect(await screen.findAllByText(/^Aurora/)).not.toHaveLength(0)
      expect(await screen.findByText('Saldo disponível')).toBeInTheDocument()
      expect(await screen.findByText(/pendências/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Ir para o backoffice' })).not.toBeInTheDocument()
    })

    it('alterna tema e abre o menu em telas estreitas', async () => {
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/app')
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Tema escuro' }))
      expect(document.documentElement.dataset.theme).toBe('dark')
      await user.click(screen.getByRole('button', { name: 'Tema claro' }))
      expect(document.documentElement.dataset.theme).toBe('light')
      await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
      expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
        'aria-expanded',
        'true',
      )
      await user.click(screen.getAllByRole('button', { name: /Sair/ })[0])
    })

    it('admin vê o atalho para o backoffice', async () => {
      vi.mocked(useAuth0).mockReturnValue(
        auth0State({ permissions: [...BACKOFFICE_PERMISSIONS, 'read:self'] }),
      )
      renderApp('/app')
      expect(await screen.findByRole('link', { name: 'Ir para o backoffice' })).toBeInTheDocument()
    })

    it('mostra erro com nova tentativa quando o /me falha', async () => {
      server.use(
        http.get('http://onboarding.test/me', () => HttpResponse.json({}, { status: 500 })),
      )
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/app')
      expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos abrir o portal')
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    })

    it('equipe sem read:self não entra no portal; cliente em "/" vai ao portal', async () => {
      vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
      const { unmount } = renderApp('/app')
      expect(await screen.findByText('Seu perfil não tem acesso ao portal')).toBeInTheDocument()
      unmount()
      vi.mocked(useAuth0).mockReturnValue(cliente())
      renderApp('/')
      expect(await screen.findByTestId('where')).toHaveTextContent('/app')
    })
  })

  it('portalHome leva cada status ao lugar certo', () => {
    expect(portalHome('RASCUNHO')).toBe('/app/onboarding')
    expect(portalHome('APROVADO')).toBe('/app')
    expect(portalHome('ANALISE_MANUAL')).toBe('/app/status')
    expect(portalHome('REPROVADO')).toBe('/app/status')
  })
})
