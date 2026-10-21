import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { customer } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { CustomersPage } from './CustomersPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
})

describe('CustomersPage', () => {
  it('lista os clientes e busca por nome ou CPF', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    api.customers.list.mockResolvedValue([
      customer(),
      customer({ id: 2, nome: 'Ana', cpf: '11122233344', financial_profile: null }),
    ])
    renderPage(<CustomersPage />, { route: '/clientes', path: '/clientes' })

    const link = await screen.findByRole('link', { name: 'João da Silva' })
    expect(link).toHaveAttribute('href', '/clientes/1')
    expect(screen.getByText('123.456.789-00')).toBeInTheDocument()
    expect(screen.getByText('R$ 8.000,00')).toBeInTheDocument()
    expect(api.customers.list).toHaveBeenCalledWith({ q: undefined })
    // Sem write:customers não há botão de cadastro.
    expect(screen.queryByRole('link', { name: 'Novo cliente' })).not.toBeInTheDocument()

    api.customers.list.mockResolvedValue([])
    await userEvent.type(screen.getByLabelText('Buscar por nome ou CPF'), ' maria ')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Nenhum cliente encontrado para "maria".')).toBeInTheDocument()
    expect(api.customers.list).toHaveBeenLastCalledWith({ q: 'maria' })
  })

  it('mostra o botão de cadastro e o estado vazio', async () => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: ['read:customers', 'write:customers'] }),
    )
    api.customers.list.mockResolvedValue([])
    renderPage(<CustomersPage />, { route: '/clientes', path: '/clientes' })

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Novo cliente' })).toHaveAttribute(
      'href',
      '/clientes/novo',
    )
  })

  it('mostra erro da API e bloqueia quem não tem read:customers', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    api.customers.list.mockRejectedValue(new AxiosError('Network Error'))
    const { unmount } = renderPage(<CustomersPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    unmount()

    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:scores'] }))
    renderPage(<CustomersPage />)
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
  })
})
