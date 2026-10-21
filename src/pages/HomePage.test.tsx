import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { checkServicesHealth } from '@/services/health'
import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { HomePage } from './HomePage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/services/health', () => ({ checkServicesHealth: vi.fn() }))

describe('HomePage', () => {
  it('cumprimenta o usuário e mostra o status dos serviços', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    vi.mocked(checkServicesHealth).mockResolvedValue([
      { name: 'Onboarding API', url: 'http://onboarding.test', online: true },
      { name: 'Credit Score API', url: 'http://score.test', online: false },
    ])
    renderPage(<HomePage />)

    expect(screen.getByRole('heading', { name: 'Olá, Maria' })).toBeInTheDocument()
    expect(await screen.findByText('Onboarding API')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.queryByText('Sua conta ainda não tem um perfil')).not.toBeInTheDocument()
  })

  it('avisa quando a conta não tem nenhuma permissão', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: [] }))
    vi.mocked(checkServicesHealth).mockResolvedValue([])
    renderPage(<HomePage />)

    expect(await screen.findByText('Sua conta ainda não tem um perfil')).toBeInTheDocument()
  })

  it('mostra erro ao ler as permissões', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ tokenError: new Error('Service not found') }))
    vi.mocked(checkServicesHealth).mockReturnValue(new Promise(() => {}))
    renderPage(<HomePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Service not found')
    expect(screen.getByText('Verificando serviços…')).toBeInTheDocument()
  })
})
