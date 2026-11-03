import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { stubIntersectionObserver } from '@/test/intersectionObserver'
import { renderPage } from '@/test/render'

import { LandingGate } from './LandingGate'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/pages/HomePage', () => ({ HomePage: () => <p>início do backoffice</p> }))

beforeEach(stubIntersectionObserver)

describe('LandingGate', () => {
  it('mostra a landing para quem não está logado', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ authenticated: false }))
    renderPage(<LandingGate />)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /encontra o crédito certo/ },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('início do backoffice')).not.toBeInTheDocument()
  })

  it('mantém o início de sempre, com o layout, para quem está logado', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State())
    renderPage(<LandingGate />)
    expect(screen.getByText('início do backoffice')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('aguarda a sessão antes de decidir', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ isLoading: true, authenticated: false }))
    renderPage(<LandingGate />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão')
  })
})
