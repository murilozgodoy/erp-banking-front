import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Permission } from '@/auth/permissions'
import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { account, customer, evaluation, strategies } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { CustomerDetailPage } from './CustomerDetailPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
  api.customers.get.mockResolvedValue(customer())
  api.scores.latest.mockResolvedValue(null)
  api.scores.history.mockResolvedValue([])
  api.scores.strategies.mockResolvedValue(strategies)
})

function renderDetail(permissions: Permission[]) {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions }))
  return renderPage(<CustomerDetailPage />, { route: '/clientes/1', path: '/clientes/:id' })
}

function httpError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('x', 'ERR', config, null, { status, data, config } as AxiosResponse)
}

describe('CustomerDetailPage', () => {
  it('mostra os dados cadastrais e, só com leitura, nenhuma ação de escrita', async () => {
    renderDetail(['read:customers'])

    expect(await screen.findByRole('heading', { name: 'João da Silva' })).toBeInTheDocument()
    expect(screen.getByText(/CPF 123\.456\.789-00/)).toBeInTheDocument()
    expect(
      screen.getByText('Rua das Flores, 123 · São Paulo/SP · CEP 01234567'),
    ).toBeInTheDocument()
    expect(screen.getByText('Anamnese ainda não registrada.')).toBeInTheDocument()
    expect(api.customers.get).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('button', { name: 'Salvar anamnese' })).not.toBeInTheDocument()
    expect(screen.queryByText('Score de crédito')).not.toBeInTheDocument()
  })

  it('salva a anamnese e recarrega o cliente', async () => {
    const user = userEvent.setup()
    api.customers.saveAnamnesis.mockResolvedValue({})
    renderDetail(['read:customers', 'write:customers'])

    await user.type(await screen.findByLabelText('Dívidas ativas (R$)'), '1500')
    await user.type(screen.getByLabelText('Comprometimento da renda (%)'), '25')
    await user.click(screen.getByRole('button', { name: 'Salvar anamnese' }))

    expect(api.customers.saveAnamnesis).toHaveBeenCalledWith(1, {
      dividas_ativas: 1500,
      comprometimento_renda: 25,
    })
    expect(await screen.findByText('Anamnese salva.')).toBeInTheDocument()
    expect(api.customers.get).toHaveBeenCalledTimes(2)
  })

  it('exibe a anamnese existente e erro ao salvar', async () => {
    const user = userEvent.setup()
    api.customers.get.mockResolvedValue(
      customer({
        anamnesis: {
          id: 1,
          dividas_ativas: 2500,
          comprometimento_renda: 35,
          updated_at: '2026-10-21T10:00:00',
        },
        address: null,
        financial_profile: null,
      }),
    )
    api.customers.saveAnamnesis.mockRejectedValue(
      httpError(403, { detail: 'Missing permission: write:customers' }),
    )
    renderDetail(['read:customers', 'write:customers'])

    expect(await screen.findByText('R$ 2.500,00')).toBeInTheDocument()
    expect(screen.getByText('35,0%')).toBeInTheDocument()
    expect(screen.getAllByText('Não informado')).toHaveLength(2) // endereço e patrimônio
    expect(screen.getByLabelText('Dívidas ativas (R$)')).toHaveValue(2500)

    await user.click(screen.getByRole('button', { name: 'Salvar anamnese' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem a permissão write:customers',
    )
  })

  it('mostra o score vigente, o histórico e calcula com a strategy escolhida', async () => {
    const user = userEvent.setup()
    api.scores.latest.mockResolvedValue(evaluation())
    api.scores.history.mockResolvedValue([
      evaluation(),
      evaluation({ id: 9, score: 640, faixa_risco: 'MEDIO', strategy_usada: 'simple' }),
    ])
    api.scores.evaluate.mockResolvedValue(evaluation({ id: 11 }))
    renderDetail(['read:customers', 'read:scores', 'write:scores'])

    expect(await screen.findByText('Score vigente')).toBeInTheDocument()
    expect(screen.getAllByText('Risco baixo').length).toBeGreaterThan(0)
    expect(screen.getByText('Aprovado')).toBeInTheDocument()
    expect(screen.getByText('Score suficiente para aprovação automática')).toBeInTheDocument()
    const historyTable = screen.getByText('Histórico de avaliações').parentElement!
    expect(within(historyTable).getByText('Risco médio')).toBeInTheDocument()

    const select = await screen.findByLabelText('Strategy de cálculo')
    await vi.waitFor(() => expect(select).toHaveValue('weighted'))
    expect(screen.getByText('Ponderada')).toBeInTheDocument()
    await user.selectOptions(select, 'simple')
    await user.click(screen.getByRole('button', { name: 'Calcular score' }))

    expect(api.scores.evaluate).toHaveBeenCalledWith(1, 'simple')
    await vi.waitFor(() => expect(api.scores.latest).toHaveBeenCalledTimes(2))
  })

  it('sem score calculado e com erro no cálculo', async () => {
    const user = userEvent.setup()
    api.scores.evaluate.mockRejectedValue(httpError(502, { detail: 'Onboarding retornou 500' }))
    renderDetail(['read:customers', 'read:scores', 'write:scores'])

    expect(
      await screen.findByText('Este cliente ainda não tem score calculado.'),
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByLabelText('Strategy de cálculo')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Calcular score' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Onboarding retornou 500')
  })

  it('mostra erro do score e das strategies', async () => {
    api.scores.latest.mockRejectedValue(
      httpError(403, { detail: 'Missing permission: read:scores' }),
    )
    api.scores.strategies.mockRejectedValue(httpError(503, null))
    renderDetail(['read:customers', 'read:scores', 'write:scores'])

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('read:scores'),
        expect.stringContaining('indisponível'),
      ]),
    )
  })

  it('lista as contas do cliente e abre conta já vinculada a ele', async () => {
    const user = userEvent.setup()
    api.accounts.list.mockResolvedValue([account()])
    api.accounts.create.mockResolvedValue(account({ id: 8 }))
    renderDetail(['read:customers', 'read:accounts', 'write:accounts'])

    expect(await screen.findByRole('link', { name: 'Conta #5' })).toBeInTheDocument()
    expect(api.accounts.list).toHaveBeenCalledWith(1)
    expect(screen.queryByLabelText('ID do cliente')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Abrir conta' }))
    expect(api.accounts.create).toHaveBeenCalledWith({ customerId: 1, saldoInicial: 0 })
    expect(await screen.findByTestId('location')).toHaveTextContent('/contas/8')
  })

  it('contas: estado vazio e erro', async () => {
    api.accounts.list.mockResolvedValue([])
    const { unmount } = renderDetail(['read:customers', 'read:accounts'])
    expect(await screen.findByText('Nenhuma conta aberta para este cliente.')).toBeInTheDocument()
    unmount()

    api.accounts.list.mockRejectedValue(httpError(403, null))
    renderDetail(['read:customers', 'read:accounts'])
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão')
  })

  it('cliente inexistente', async () => {
    api.customers.get.mockRejectedValue(httpError(404, { detail: 'Cliente 1 não encontrado' }))
    renderDetail(['read:customers'])

    expect(await screen.findByRole('alert')).toHaveTextContent('Cliente 1 não encontrado')
    expect(screen.getByRole('link', { name: 'Voltar para clientes' })).toHaveAttribute(
      'href',
      '/clientes',
    )
  })
})
