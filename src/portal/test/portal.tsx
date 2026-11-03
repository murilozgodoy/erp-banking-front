/* eslint-disable react-refresh/only-export-components -- helper de teste, não é módulo de UI */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { resetMockDb } from '../mocks/db'
import { mockServer } from '../mocks/server'
import type { OnboardingStatus } from '../types'

/**
 * Liga o servidor MSW (contratos de PORTAL_CLIENTE.md) para o arquivo de teste. As páginas do
 * portal são testadas contra os mesmos mocks usados no navegador.
 *
 * Uso: `useMockApi('APROVADO')` no topo do `describe` (ou do arquivo).
 */
export function useMockApi(status: OnboardingStatus = 'APROVADO') {
  beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }))
  beforeEach(() => resetMockDb(status))
  afterEach(() => mockServer.resetHandlers())
  afterAll(() => mockServer.close())
  return mockServer
}

/** Mostra para onde a página navegou (rota coringa dos testes). */
function CurrentLocation() {
  const location = useLocation()
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
    </p>
  )
}

interface RenderPortalOptions {
  /** URL inicial (ex.: `/app/credito?produto=ANTECIPACAO`). */
  route?: string
  /** Padrão de rota da página (ex.: `/app/credito`). */
  path?: string
}

/** Renderiza uma página do portal com React Query (sem retry) e roteador em memória. */
export function renderPortal(
  ui: ReactElement,
  { route = '/app', path = '/app' }: RenderPortalOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient, ...result }
}
