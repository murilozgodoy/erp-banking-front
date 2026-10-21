import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Permission } from '@/auth/permissions'
import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { credit } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { CreditsPage } from './CreditsPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
})

function renderCredits(permissions: Permission[]) {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions }))
  return renderPage(<CreditsPage />, { route: '/creditos', path: '/creditos' })
}

async function requestCredit(customerId: string, valor: string, prazo: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('ID do cliente'), customerId)
  await user.type(screen.getByLabelText('Valor solicitado (R$)'), valor)
  await user.clear(screen.getByLabelText('Prazo (meses)'))
  await user.type(screen.getByLabelText('Prazo (meses)'), prazo)
  await user.click(screen.getByRole('button', { name: 'Solicitar crédito' }))
}

describe('CreditsPage', () => {
  it('lista os pedidos com decisão, taxa e valor aprovado', async () => {
    api.credits.list.mockResolvedValue([
      credit(),
      credit({
        id: 8,
        customerId: 2,
        status: 'NEGADO',
        motivo: 'Cliente sem score de crédito registrado',
        scoreSnapshot: null,
        valorAprovado: 0,
        taxaJuros: 0,
      }),
    ])
    renderCredits(['read:credits'])

    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('Aprovado')).toBeInTheDocument()
    expect(within(rows[1]).getByText('2,99% a.m.')).toBeInTheDocument()
    expect(within(rows[1]).getAllByText('R$ 10.000,00')).toHaveLength(2)
    expect(within(rows[2]).getByText('Negado')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Cliente sem score de crédito registrado')).toBeInTheDocument()
    expect(within(rows[2]).getAllByText('—')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Solicitar crédito' })).not.toBeInTheDocument()
  })

  it('solicita crédito e mostra a aprovação', async () => {
    api.credits.list.mockResolvedValue([])
    api.credits.request.mockResolvedValue(credit())
    renderCredits(['read:credits', 'write:credits'])

    expect(await screen.findByText('Nenhum pedido de crédito.')).toBeInTheDocument()
    await requestCredit('1', '10000', '24')

    expect(api.credits.request).toHaveBeenCalledWith({
      customerId: 1,
      valor: 10000,
      prazoMeses: 24,
    })
    expect(await screen.findByText('Crédito aprovado')).toBeInTheDocument()
    expect(
      screen.getByText(/R\$ 10\.000,00 em 24 meses, com taxa de 2,99% a\.m\./),
    ).toBeInTheDocument()
    expect(api.credits.list).toHaveBeenCalledTimes(2)
  })

  it('mostra revisão manual, negação e erro da API', async () => {
    api.credits.list.mockResolvedValue([])
    api.credits.request.mockResolvedValueOnce(
      credit({ status: 'REVISAO', motivo: 'Requer revisão manual — risco médio' }),
    )
    renderCredits(['read:credits', 'write:credits'])

    await requestCredit('1', '5000', '12')
    expect(await screen.findByText('Pedido enviado para revisão manual')).toBeInTheDocument()

    api.credits.request.mockResolvedValueOnce(
      credit({ status: 'NEGADO', motivo: 'Negado — risco ALTO' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar crédito' }))
    expect(await screen.findByText('Crédito negado')).toBeInTheDocument()
    expect(screen.getByText('Negado — risco ALTO')).toBeInTheDocument()

    const config = { headers: new AxiosHeaders() }
    const response = {
      status: 403,
      data: { error: 'Sem permissão para consultar o score (read:scores)' },
      config,
    } as AxiosResponse
    api.credits.request.mockRejectedValueOnce(new AxiosError('x', 'ERR', config, null, response))
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar crédito' }))
    expect(
      await screen.findByText('Sem permissão para consultar o score (read:scores)'),
    ).toBeInTheDocument()
  })

  it('filtra por cliente, mostra erro e exige read:credits', async () => {
    const user = userEvent.setup()
    api.credits.list.mockResolvedValue([])
    const { unmount } = renderCredits(['read:credits'])

    await user.type(await screen.findByLabelText('Filtrar por ID do cliente'), '3')
    await user.click(screen.getByRole('button', { name: 'Filtrar' }))
    expect(
      await screen.findByText('Nenhum pedido de crédito para o cliente #3.'),
    ).toBeInTheDocument()
    expect(api.credits.list).toHaveBeenLastCalledWith(3)
    unmount()

    api.credits.list.mockRejectedValue(new AxiosError('Network Error'))
    const second = renderCredits(['read:credits'])
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    second.unmount()

    renderCredits(['read:customers'])
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
  })
})
