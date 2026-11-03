import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MotionGlobalConfig } from 'motion/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import { setMembroLogado } from '../../mocks/team'
import { renderPortal, useMockApi } from '../../test/portal'
import { OnboardingPage } from './OnboardingPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.setConfig({ testTimeout: 30_000 })

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

describe('OnboardingPage: quem não é o dono só lê (seção 11)', () => {
  const server = useMockApi('RASCUNHO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => setMembroLogado(null))

  it('explica, trava os campos, navega pelos passos e nunca salva nem envia', async () => {
    setMembroLogado('ADMIN')
    let puts = 0
    server.use(
      http.put(`${env.onboardingApiUrl}/me/onboarding`, () => {
        puts++
      }),
    )
    const user = userEvent.setup()
    renderPortal(<OnboardingPage />, { route: '/app/onboarding', path: '/app/onboarding' })

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Só o dono da empresa edita o cadastro' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
    for (const campo of screen.getAllByRole('textbox')) expect(campo).toBeDisabled()

    // Navega até a revisão sem validar nada e sem botão de envio.
    for (let i = 0; i < 3; i++) {
      const proximo = screen.queryByRole('button', { name: /Próximo passo/ })
      if (!proximo) break
      await user.click(proximo)
    }
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Observações e revisão' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar para análise/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Próximo passo/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(puts).toBe(0)
  })

  it('o dono continua editando normalmente', async () => {
    renderPortal(<OnboardingPage />, { route: '/app/onboarding', path: '/app/onboarding' })
    await screen.findByRole('heading', { level: 1, name: 'Cadastro da empresa' })
    await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0))
    expect(screen.queryByText('Só o dono da empresa edita o cadastro')).toBeNull()
    expect(screen.getAllByRole('textbox')[0]).toBeEnabled()
  })
})
