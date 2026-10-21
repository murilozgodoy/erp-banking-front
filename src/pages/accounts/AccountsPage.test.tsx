import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { account } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { AccountsPage } from './AccountsPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
})

describe('AccountsPage', () => {
  it('lista as contas e filtra por cliente', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:accounts'] }))
    api.accounts.list.mockResolvedValue([
      account(),
      account({ id: 6, customerId: 2, saldo: 0, status: 'BLOCKED' }),
    ])
    renderPage(<AccountsPage />, { route: '/contas', path: '/contas' })

    expect(await screen.findByRole('link', { name: 'Conta #5' })).toHaveAttribute(
      'href',
      '/contas/5',
    )
    expect(screen.getByRole('link', { name: 'Cliente #2' })).toHaveAttribute('href', '/clientes/2')
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument()
    expect(screen.getByText('Bloqueada')).toBeInTheDocument()
    expect(api.accounts.list).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('button', { name: 'Abrir conta' })).not.toBeInTheDocument()

    api.accounts.list.mockResolvedValue([])
    await user.type(screen.getByLabelText('Filtrar por ID do cliente'), '9')
    await user.click(screen.getByRole('button', { name: 'Filtrar' }))

    expect(await screen.findByText('Nenhuma conta para o cliente #9.')).toBeInTheDocument()
    expect(api.accounts.list).toHaveBeenLastCalledWith(9)
  })

  it('abre conta para um cliente e navega para ela', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: ['read:accounts', 'write:accounts'] }),
    )
    api.accounts.list.mockResolvedValue([])
    api.accounts.create.mockResolvedValue(account({ id: 33 }))
    renderPage(<AccountsPage />, { route: '/contas', path: '/contas' })

    expect(await screen.findByText('Nenhuma conta aberta.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('ID do cliente'), '4')
    await user.clear(screen.getByLabelText('Saldo inicial (R$)'))
    await user.type(screen.getByLabelText('Saldo inicial (R$)'), '250.5')
    await user.click(screen.getByRole('button', { name: 'Abrir conta' }))

    expect(api.accounts.create).toHaveBeenCalledWith({ customerId: 4, saldoInicial: 250.5 })
    expect(await screen.findByTestId('location')).toHaveTextContent('/contas/33')
  })

  it('mostra erros da API e ao abrir conta', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: ['read:accounts', 'write:accounts'] }),
    )
    api.accounts.list.mockRejectedValue(new AxiosError('Network Error'))
    api.accounts.create.mockRejectedValue(new Error('falha ao abrir'))
    renderPage(<AccountsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    await user.type(screen.getByLabelText('ID do cliente'), '1')
    await user.click(screen.getByRole('button', { name: 'Abrir conta' }))
    expect(await screen.findByText('falha ao abrir')).toBeInTheDocument()
  })

  it('exige read:accounts', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    renderPage(<AccountsPage />)
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
    expect(api.accounts.list).not.toHaveBeenCalled()
  })
})
