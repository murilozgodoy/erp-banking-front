import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMockApi } from '@/portal/test/portal'
import { auth0State } from '@/test/auth0'

import { InvitePage } from './InvitePage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const O = 'http://onboarding.test'

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderInvite(token: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/convite/${token}`]}>
        <Routes>
          <Route path="/convite/:token" element={<InvitePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { invalidate }
}

describe('InvitePage', () => {
  const server = useMockApi('APROVADO')

  describe('sem login', () => {
    it('explica o convite e leva ao Auth0 para entrar ou criar conta, voltando ao convite', async () => {
      const auth = auth0State({ authenticated: false })
      vi.mocked(useAuth0).mockReturnValue(auth)
      const user = userEvent.setup()
      renderInvite('convite-demo-contador')
      expect(
        screen.getByRole('heading', {
          name: 'Você foi convidado para a equipe de uma empresa na ErpIa',
        }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      expect(auth.loginWithRedirect).toHaveBeenCalledWith({
        appState: { returnTo: '/convite/convite-demo-contador' },
      })
      await user.click(screen.getByRole('button', { name: 'Criar conta' }))
      expect(auth.loginWithRedirect).toHaveBeenLastCalledWith({
        appState: { returnTo: '/convite/convite-demo-contador' },
        authorizationParams: { screen_hint: 'signup' },
      })
    })

    it('enquanto o Auth0 carrega, mostra o esqueleto', () => {
      vi.mocked(useAuth0).mockReturnValue(auth0State({ isLoading: true }))
      renderInvite('x')
      expect(screen.getByRole('status', { name: 'Verificando sua sessão…' })).toBeInTheDocument()
    })
  })

  describe('com login', () => {
    beforeEach(() => {
      vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self'] }))
    })

    it('aceita uma vez, confirma e abre o portal depois de atualizar o /me', async () => {
      let calls = 0
      server.events.on('request:start', ({ request }) => {
        if (request.url.endsWith('/accept')) calls++
      })
      const { invalidate } = renderInvite('convite-demo-contador')
      expect(screen.getByRole('status', { name: 'Entrando na equipe…' })).toBeInTheDocument()
      expect(
        await screen.findByRole('heading', { name: 'Pronto, você entrou na equipe' }),
      ).toBeInTheDocument()
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['portal', 'me'] })
      expect(await screen.findByTestId('where', {}, { timeout: 3000 })).toHaveTextContent('/app')
      expect(calls).toBe(1)
      server.events.removeAllListeners()
    })

    it('410: convite expirado, com o próximo passo', async () => {
      renderInvite('convite-expirado')
      expect(
        await screen.findByRole('heading', { name: 'Este convite expirou' }),
      ).toBeInTheDocument()
      expect(screen.getByText(/Peça a quem convidou você um link novo/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/')
    })

    it('409 JA_VINCULADO: a conta é de outra empresa; oferece entrar com outra conta', async () => {
      const auth = auth0State({ permissions: ['read:self'] })
      vi.mocked(useAuth0).mockReturnValue(auth)
      const user = userEvent.setup()
      renderInvite('convite-outra-empresa')
      expect(
        await screen.findByRole('heading', { name: 'Esta conta já pertence a outra empresa' }),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Entrar com outra conta' }))
      expect(auth.logout).toHaveBeenCalledWith({
        logoutParams: { returnTo: `${window.location.origin}/convite/convite-outra-empresa` },
      })
      expect(screen.getByRole('link', { name: 'Ir para o meu portal' })).toHaveAttribute(
        'href',
        '/app',
      )
    })

    it('404: convite não encontrado', async () => {
      renderInvite('nao-existe')
      expect(
        await screen.findByRole('heading', { name: 'Convite não encontrado' }),
      ).toBeInTheDocument()
    })

    it('erro inesperado: mensagem e "Tentar de novo"', async () => {
      server.use(
        http.post(
          `${O}/me/team/invites/:token/accept`,
          () => HttpResponse.json({ error: 'X' }, { status: 503 }),
          { once: true },
        ),
      )
      const user = userEvent.setup()
      renderInvite('convite-demo-contador')
      expect(
        await screen.findByRole('heading', { name: 'Não conseguimos aceitar o convite' }),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Pronto, você entrou na equipe' }),
        ).toBeInTheDocument(),
      )
    })
  })
})
