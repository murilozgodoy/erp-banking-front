import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Permission } from '@/auth/permissions'
import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { account, transaction } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { AccountDetailPage } from './AccountDetailPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
  api.accounts.get.mockResolvedValue(account())
  api.accounts.statement.mockResolvedValue([
    transaction({ id: 2, tipo: 'DEBIT', valor: 200, saldoAtual: 1500 }),
    transaction({ id: 1, tipo: 'CREDIT', valor: 700, saldoAtual: 1700 }),
  ])
})

function renderDetail(permissions: Permission[]) {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions }))
  return renderPage(<AccountDetailPage />, { route: '/contas/5', path: '/contas/:id' })
}

function httpError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('x', 'ERR', config, null, { status, data, config } as AxiosResponse)
}

describe('AccountDetailPage', () => {
  it('mostra saldo, titular e extrato', async () => {
    renderDetail(['read:accounts'])

    expect(await screen.findByRole('heading', { name: 'Conta #5' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'cliente #1' })).toHaveAttribute('href', '/clientes/1')
    expect(screen.getByText('Ativa')).toBeInTheDocument()

    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('Débito')).toBeInTheDocument()
    expect(within(rows[1]).getByText('− R$ 200,00')).toBeInTheDocument()
    expect(within(rows[2]).getByText('+ R$ 700,00')).toBeInTheDocument()
    expect(within(rows[2]).getByText('R$ 1.700,00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument()
  })

  it('registra um débito e atualiza saldo e extrato', async () => {
    const user = userEvent.setup()
    api.accounts.registerTransaction.mockResolvedValue(transaction({ saldoAtual: 1400 }))
    renderDetail(['read:accounts', 'write:accounts'])

    await user.selectOptions(await screen.findByLabelText('Tipo'), 'DEBIT')
    await user.type(screen.getByLabelText('Valor (R$)'), '100')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(api.accounts.registerTransaction).toHaveBeenCalledWith({
      accountId: 5,
      tipo: 'DEBIT',
      valor: 100,
    })
    expect(
      await screen.findByText('Transação registrada. Saldo atual: R$ 1.400,00.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue(null)
    expect(api.accounts.statement).toHaveBeenCalledTimes(2)
    expect(api.accounts.get).toHaveBeenCalledTimes(2)
  })

  it('mostra saldo insuficiente e bloqueia conta inativa', async () => {
    const user = userEvent.setup()
    api.accounts.registerTransaction.mockRejectedValue(
      httpError(422, { error: 'Saldo insuficiente para débito' }),
    )
    const { unmount } = renderDetail(['read:accounts', 'write:accounts'])

    await user.type(await screen.findByLabelText('Valor (R$)'), '99999')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Saldo insuficiente para débito')
    unmount()

    api.accounts.get.mockResolvedValue(account({ status: 'BLOCKED' }))
    renderDetail(['read:accounts', 'write:accounts'])
    expect(await screen.findByRole('button', { name: 'Registrar' })).toBeDisabled()
  })

  it('extrato vazio, erro no extrato e conta inexistente', async () => {
    api.accounts.statement.mockResolvedValue([])
    const { unmount } = renderDetail(['read:accounts'])
    expect(await screen.findByText('Nenhuma transação registrada.')).toBeInTheDocument()
    unmount()

    api.accounts.statement.mockRejectedValue(httpError(503, null))
    const second = renderDetail(['read:accounts'])
    expect(await screen.findByRole('alert')).toHaveTextContent('indisponível')
    second.unmount()

    api.accounts.get.mockRejectedValue(httpError(404, { error: 'Conta 5 não encontrada' }))
    renderDetail(['read:accounts'])
    expect(await screen.findByRole('alert')).toHaveTextContent('Conta 5 não encontrada')
    expect(screen.getByRole('link', { name: 'Voltar para contas' })).toHaveAttribute(
      'href',
      '/contas',
    )
  })
})
