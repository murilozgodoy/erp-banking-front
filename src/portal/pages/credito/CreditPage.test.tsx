import { useAuth0 } from '@auth0/auth0-react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import * as db from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import type { SimulationRequest } from '../../types'
import { CreditPage } from './CreditPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const API = env.transactionsApiUrl

function renderCredit(route = '/app/credito') {
  return renderPortal(<CreditPage />, { route, path: '/app/credito' })
}

/** Registra os corpos enviados ao simulador e responde com o banco em memória. */
function captureSimulations(server: ReturnType<typeof useMockApi>) {
  const bodies: SimulationRequest[] = []
  server.use(
    http.post(`${API}/me/credit/simulations`, async ({ request }) => {
      const body = (await request.json()) as SimulationRequest
      bodies.push(body)
      const result = db.simularCredito(body)
      return result.tipo === 'ok'
        ? HttpResponse.json(result.simulation, { status: 201 })
        : HttpResponse.json(result.body, { status: result.http })
    }),
  )
  return bodies
}

describe('CreditPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('mostra título, insight, limites e simula o capital de giro por padrão', async () => {
    renderCredit()
    expect(screen.getByRole('heading', { name: 'Crédito' })).toBeInTheDocument()
    const limites = await screen.findByRole('radiogroup', { name: 'Seus limites' })
    expect(within(limites).getAllByRole('radio')).toHaveLength(4)
    expect(within(limites).getByRole('radio', { name: /Capital de giro/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(await screen.findByRole('complementary', { name: 'Insight da ErpIa' })).toBeVisible()
    expect(await screen.findByText(/Parcela mensal · 12x/)).toBeInTheDocument()
    // Taxas da simulação em PERCENTUAL.
    const simulador = screen.getByRole('region', { name: 'Simular capital de giro' })
    expect(within(simulador).getByText(/^\d+,\d{2}% a\.m\.$/)).toBeInTheDocument()
    expect(within(simulador).getByText(/^\d+,\d{2}% a\.a\.$/)).toBeInTheDocument()
    expect(within(simulador).getByText('Pré-aprovado')).toBeInTheDocument()
  })

  it('preenche o simulador pelos parâmetros da URL', async () => {
    const bodies = captureSimulations(server)
    renderCredit('/app/credito?produto=ALAVANCAGEM&valor=20000')
    expect(await screen.findByRole('radio', { name: /Crédito para crescer/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByLabelText('Valor')).toHaveValue('20.000,00')
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ produto: 'ALAVANCAGEM', valor: 20000, prazo_meses: 12 })
  })

  it('simula com debounce: uma chamada só depois de parar de digitar', async () => {
    const user = userEvent.setup()
    const bodies = captureSimulations(server)
    renderCredit('/app/credito?produto=CAPITAL_DE_GIRO&valor=10000')
    await waitFor(() => expect(bodies).toHaveLength(1))
    const valor = screen.getByLabelText('Valor')
    await user.clear(valor)
    await user.type(valor, '15000')
    await user.click(screen.getByRole('radio', { name: '6x' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toEqual({ produto: 'CAPITAL_DE_GIRO', valor: 15000, prazo_meses: 6 })
    expect(await screen.findByText(/Parcela mensal · 6x/)).toBeInTheDocument()
  })

  it('não simula valor zerado', async () => {
    const user = userEvent.setup()
    renderCredit()
    const valor = await screen.findByLabelText('Valor')
    await user.clear(valor)
    expect(screen.getByText('Informe um valor para ver as condições.')).toBeInTheDocument()
    await user.type(valor, '0')
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument()
  })

  it('o controle deslizante e a troca de produto refazem a simulação', async () => {
    const user = userEvent.setup()
    const bodies = captureSimulations(server)
    renderCredit()
    await waitFor(() => expect(bodies).toHaveLength(1))
    await user.click(screen.getByRole('radio', { name: /Financiamento de estoque/ }))
    await waitFor(() => expect(bodies.at(-1)?.produto).toBe('FINANCIAMENTO_ESTOQUE'))
    expect(bodies.at(-1)?.prazo_meses).toBe(12)
    const slider = screen.getByRole('slider', { name: 'Ajustar valor' })
    fireEvent.change(slider, { target: { value: '5000' } })
    await waitFor(() => expect(bodies.at(-1)?.valor).toBe(5000))
  })

  it('valor acima do limite vai para análise', async () => {
    renderCredit('/app/credito?produto=CAPITAL_DE_GIRO&valor=99999999')
    expect(
      await screen.findByText('Acima do limite pré-aprovado: a proposta passa por análise.'),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Este valor passa da capacidade/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contratar' })).toBeDisabled()
  })

  it('abre e fecha o cronograma de parcelas', async () => {
    const user = userEvent.setup()
    renderCredit()
    await user.click(await screen.findByRole('button', { name: 'Ver cronograma (12 parcelas)' }))
    const table = screen.getByRole('table', { name: 'Cronograma de parcelas' })
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    await user.click(screen.getByRole('button', { name: 'Ocultar cronograma' }))
    expect(screen.queryByRole('table', { name: 'Cronograma de parcelas' })).not.toBeInTheDocument()
  })

  it('contrata: confirma no painel e mostra o crédito aprovado', async () => {
    const user = userEvent.setup()
    renderCredit('/app/credito?produto=CAPITAL_DE_GIRO&valor=10000')
    await screen.findByText(/Parcela mensal · 12x/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contratar' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Contratar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar contratação' })
    expect(within(dialog).getByText('Primeiro vencimento')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar contratação' }))
    expect(await within(dialog).findByText('Crédito contratado')).toBeInTheDocument()
    expect(within(dialog).getByText('Valor aprovado')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const propostas = screen.getByRole('table', { name: 'Propostas e contratos de crédito' })
    await waitFor(() => expect(within(propostas).getAllByRole('row')).toHaveLength(3))
  })

  it('valor em análise vira proposta em revisão', async () => {
    const user = userEvent.setup()
    const offers = db.ofertas()
    const capital = offers.find((o) => o.produto === 'CAPITAL_DE_GIRO')!
    renderCredit(`/app/credito?produto=CAPITAL_DE_GIRO&valor=${Math.round(capital.limite * 1.2)}`)
    await user.click(await screen.findByRole('button', { name: 'Enviar proposta' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Enviar para análise' }))
    expect(await within(dialog).findByText('Proposta enviada para análise')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Em análise').length).toBeGreaterThan(0)
  })

  it('simulação expirada: explica e oferece simular de novo', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API}/me/credit/requests`, () =>
        HttpResponse.json(
          { error: 'SIMULACAO_EXPIRADA', message: 'Simulação expirada: simule de novo.' },
          { status: 422 },
        ),
      ),
    )
    renderCredit()
    await screen.findByText(/Parcela mensal/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contratar' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Contratar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar contratação' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Esta simulação expirou. Simule de novo para ver as condições de hoje.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Simular de novo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('erro da simulação aparece com a mensagem da API', async () => {
    server.use(
      http.post(`${API}/me/credit/simulations`, () =>
        HttpResponse.json(
          {
            error: 'validation_failed',
            message: 'Dados inválidos.',
            campos: { prazo_meses: 'O prazo máximo é 24 meses.' },
          },
          { status: 400 },
        ),
      ),
    )
    renderCredit()
    expect(await screen.findByText('O prazo máximo é 24 meses.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('antecipação no simulador manda escolher os recebíveis', async () => {
    renderCredit('/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=5000')
    expect(await screen.findByRole('link', { name: /Escolher recebíveis/ })).toHaveAttribute(
      'href',
      '/app/recebiveis',
    )
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument()
  })

  it('propostas mostram a taxa convertida de fração para percentual', async () => {
    renderCredit()
    const table = await screen.findByRole('table', { name: 'Propostas e contratos de crédito' })
    // Proposta semeada: taxaJuros 0.0209 (fração ao mês).
    expect(within(table).getByText('2,09% a.m.')).toBeInTheDocument()
    expect(within(table).getByText('Aprovado')).toBeInTheDocument()
    expect(within(table).getByText('1 mês')).toBeInTheDocument()
  })

  it('sem ofertas: estado vazio honesto', async () => {
    server.use(http.get(`${API}/me/credit/offers`, () => HttpResponse.json([])))
    renderCredit()
    expect(await screen.findByText('Sem limite pré-aprovado agora')).toBeInTheDocument()
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument()
  })

  it('sem propostas: estado vazio que ensina', async () => {
    server.use(http.get(`${API}/me/credit/requests`, () => HttpResponse.json([])))
    renderCredit()
    expect(await screen.findByText('Nenhuma proposta ainda')).toBeInTheDocument()
  })

  it('erro ao carregar ofertas e propostas tem nova tentativa', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/me/credit/offers`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
      http.get(`${API}/me/credit/requests`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    renderCredit()
    const retries = await screen.findAllByRole('button', { name: 'Tentar de novo' })
    expect(retries).toHaveLength(2)
    for (const retry of retries) await user.click(retry)
    expect(await screen.findByRole('radiogroup', { name: 'Seus limites' })).toBeInTheDocument()
  })
})

describe('CreditPage com cadastro pendente', () => {
  useMockApi('EM_ANALISE')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('explica que o crédito abre depois da aprovação', async () => {
    renderCredit()
    expect(await screen.findByText('Seu cadastro ainda está em análise')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acompanhar análise' })).toHaveAttribute(
      'href',
      '/app/status',
    )
  })
})
