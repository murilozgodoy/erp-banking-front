import { screen } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { decisionEvent } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { DecisionEventsCard } from './DecisionEventsCard'

vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
})

function httpError(status: number) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('x', 'ERR', config, null, {
    status,
    data: {},
    config,
  } as AxiosResponse)
}

describe('DecisionEventsCard', () => {
  it('lista as decisões recebidas por evento', async () => {
    api.scores.decisions.mockResolvedValue([
      decisionEvent(),
      decisionEvent({
        event_id: 'aaaaaaaa-0000',
        credit_request_id: 8,
        status: 'NEGADO',
        motivo: null,
        score: null,
        faixa_risco: null,
        taxa_juros: 0,
      }),
    ])
    renderPage(<DecisionEventsCard customerId={1} />)

    expect(await screen.findByText('#7')).toBeInTheDocument()
    expect(screen.getByText('Aprovado')).toBeInTheDocument()
    expect(screen.getByText('Negado')).toBeInTheDocument()
    expect(screen.getByText('Risco baixo')).toBeInTheDocument()
    expect(screen.getByText('2,99% a.m.')).toBeInTheDocument()
    expect(screen.getByText('7b1f0c2e')).toBeInTheDocument()
    expect(api.scores.decisions).toHaveBeenCalledWith(1)
  })

  it('mostra estado vazio sem decisões', async () => {
    api.scores.decisions.mockResolvedValue([])
    renderPage(<DecisionEventsCard customerId={1} />)

    expect(
      await screen.findByText('Nenhuma decisão recebida por evento para este cliente.'),
    ).toBeInTheDocument()
  })

  it('404: endpoint ainda não disponível no Score', async () => {
    api.scores.decisions.mockRejectedValue(httpError(404))
    renderPage(<DecisionEventsCard customerId={1} />)

    expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
  })

  it('outros erros viram alerta', async () => {
    api.scores.decisions.mockRejectedValue(httpError(403))
    renderPage(<DecisionEventsCard customerId={1} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('permissão')
  })
})
