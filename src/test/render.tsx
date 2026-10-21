import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

/** Rota "coringa" dos testes: mostra para onde a página navegou. */
function CurrentLocation() {
  const location = useLocation()
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
    </p>
  )
}

interface RenderPageOptions {
  /** URL inicial (ex.: `/clientes/5`). */
  route?: string
  /** Padrão de rota da página (ex.: `/clientes/:id`). */
  path?: string
}

/** Renderiza uma página com React Query e roteador em memória. */
export function renderPage(ui: ReactElement, { route = '/', path = '/' }: RenderPageOptions = {}) {
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
