import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BACKOFFICE_PERMISSIONS } from '@/auth/permissions'
import { checkServicesHealth } from '@/services/health'
import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { MonitoringPage } from './MonitoringPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/services/health', () => ({ checkServicesHealth: vi.fn() }))

describe('MonitoringPage', () => {
  it('admin vê o status dos serviços e do gateway, com latência e links', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: BACKOFFICE_PERMISSIONS }))
    vi.mocked(checkServicesHealth).mockResolvedValue([
      { name: 'Onboarding API', url: 'http://onboarding.test', online: true, latencyMs: 12 },
      { name: 'Credit Score API', url: 'http://score.test', online: false },
      { name: 'API Gateway', url: 'http://gateway.test', online: true, latencyMs: 3 },
    ])
    renderPage(<MonitoringPage />)

    expect(await screen.findByText('API Gateway')).toBeInTheDocument()
    expect(screen.getByText('12 ms')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText(/2 de 3 no ar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Grafana/ })).toHaveAttribute(
      'href',
      'http://grafana.test',
    )
    expect(screen.getByRole('link', { name: /^Prometheus/ })).toHaveAttribute(
      'href',
      'http://prometheus.test/targets',
    )
    expect(screen.getByRole('link', { name: /Swagger — Transactions/ })).toHaveAttribute(
      'href',
      'http://transactions.test/swagger-ui/index.html',
    )
    expect(screen.queryByRole('link', { name: /Swagger — Onboarding/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Verificar agora' }))
    await vi.waitFor(() => expect(checkServicesHealth).toHaveBeenCalledTimes(2))
  })

  it('mostra carregamento enquanto verifica', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: BACKOFFICE_PERMISSIONS }))
    vi.mocked(checkServicesHealth).mockReturnValue(new Promise(() => {}))
    renderPage(<MonitoringPage />)

    expect(await screen.findByText('Verificando serviços…')).toBeInTheDocument()
  })

  it('nega acesso a quem não é admin', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    renderPage(<MonitoringPage />)

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
    expect(checkServicesHealth).not.toHaveBeenCalled()
  })

  it('mostra erro ao ler as permissões', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ tokenError: new Error('falhou') }))
    renderPage(<MonitoringPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('falhou')
  })
})
