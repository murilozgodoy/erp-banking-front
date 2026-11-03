import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import * as db from '../mocks/db'
import { setMembroLogado } from '../mocks/team'
import { useMockApi } from '../test/portal'
import type { Me, Permissao } from '../types'
import { InsightBlock } from '../ui/InsightBlock'
import { PortalGate } from './PortalGate'
import { PortalLayout } from './PortalLayout'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const insight = {
  titulo: 'Semana apertada',
  texto: 'O caixa fica curto.',
  severidade: 'atencao' as const,
}

function Page({ name }: { name: string }) {
  return (
    <>
      <h1>{name}</h1>
      <InsightBlock insight={insight} />
    </>
  )
}

function renderApp(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app" element={<PortalGate />}>
            <Route element={<PortalLayout />}>
              <Route index element={<Page name="Visão geral" />} />
              <Route path="equipe" element={<Page name="Equipe" />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

describe('portal com permissões (seção 11)', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => setMembroLogado(null))

  function membroCom(permissoes: Permissao[]) {
    server.use(
      http.get(`${env.onboardingApiUrl}/me`, () => {
        const me: Me = db.me()
        return HttpResponse.json({
          ...me,
          membro: {
            id: 7,
            nome: 'Ana Souza',
            papel: 'ADMIN',
            permissoes,
            limite_pagamento: null,
            status: 'ATIVO',
          },
        })
      }),
    )
  }

  it('sem ver_financeiro: uma página inteira explica, em vez de painéis quebrados', async () => {
    membroCom(['gerenciar_equipe'])
    const user = userEvent.setup()
    renderApp('/app')
    expect(
      await screen.findByRole('heading', { name: 'Você não tem acesso aos números da empresa' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Visão geral' })).not.toBeInTheDocument()
    expect(screen.getByText(/Seu papel: Administrador · Ana Souza/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Abrir a equipe' }))
    expect(await screen.findByRole('heading', { name: 'Equipe' })).toBeInTheDocument()
  })

  it('com ver_financeiro, a página abre normalmente', async () => {
    setMembroLogado('LEITURA')
    renderApp('/app')
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.queryByText(/não tem acesso aos números/)).not.toBeInTheDocument()
  })

  it('sem usar_assistente: rail travado com o motivo, sem botão flutuante nem atalho', async () => {
    setMembroLogado('LEITURA')
    const user = userEvent.setup()
    renderApp('/app')
    await screen.findByRole('heading', { name: 'Visão geral' })
    const travado = await screen.findByRole('button', { name: 'Perguntar à ErpIa' })
    await waitFor(() => expect(travado).toHaveAttribute('aria-disabled', 'true'))
    expect(travado).toHaveAccessibleDescription(
      'Peça a um administrador a permissão de usar o assistente.',
    )
    // Só o item do rail: o botão flutuante (telas estreitas) não existe.
    expect(screen.getAllByRole('button', { name: 'Perguntar à ErpIa' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /sobre isso/ })).not.toBeInTheDocument()
    await user.click(travado)
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('com usar_assistente, as entradas do assistente aparecem', async () => {
    setMembroLogado('OPERADOR')
    renderApp('/app')
    await screen.findByRole('heading', { name: 'Visão geral' })
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Perguntar à ErpIa' })).toHaveLength(2),
    )
    expect(screen.getByRole('button', { name: /sobre isso/ })).toBeInTheDocument()
  })

  it('um 403 SEM_PERMISSAO busca o /me de novo', async () => {
    let chamadas = 0
    server.use(
      http.get(`${env.onboardingApiUrl}/me`, () => {
        chamadas++
        return HttpResponse.json(db.me())
      }),
      http.get(`${env.transactionsApiUrl}/me/overview`, () =>
        HttpResponse.json({ error: 'SEM_PERMISSAO', permissao: 'ver_financeiro' }, { status: 403 }),
      ),
    )
    renderApp('/app')
    await screen.findByRole('heading', { name: 'Visão geral' })
    await waitFor(() => expect(chamadas).toBeGreaterThanOrEqual(2))
  })
})
