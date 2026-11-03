import { useAuth0 } from '@auth0/auth0-react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import * as db from '../../mocks/db'
import { money } from '../../lib/format'
import { renderPortal, useMockApi } from '../../test/portal'
import type { SimulationRequest } from '../../types'
import { ReceivablesPage } from './ReceivablesPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const API = env.transactionsApiUrl

function renderPage() {
  return renderPortal(<ReceivablesPage />, { route: '/app/recebiveis', path: '/app/recebiveis' })
}

function tabela() {
  return screen.getByRole('table', { name: 'Recebíveis' })
}

/** Linhas de dados (sem o cabeçalho). */
function linhas() {
  return within(tabela()).getAllByRole('row').slice(1)
}

describe('ReceivablesPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('mostra indicadores, agenda, insight e a tabela de recebíveis a receber', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Recebíveis' })).toBeInTheDocument()
    expect(await screen.findByText('A receber em 90 dias')).toBeInTheDocument()
    expect(screen.getByText('Próximos 7 dias')).toBeInTheDocument()
    expect(screen.getByText('Já antecipado')).toBeInTheDocument()
    expect(screen.getByText('Taxa média do adquirente')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Valor líquido a receber por semana' })).toBeVisible()
    expect(linhas().length).toBeGreaterThan(0)
    expect(within(tabela()).queryByText('Recebido')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Selecionar recebíveis/ })).toBeInTheDocument()
  })

  it('filtra por status e adquirente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('A receber em 90 dias')
    await user.click(screen.getByRole('radio', { name: 'Recebidos' }))
    for (const row of linhas()) expect(within(row).getByText('Recebido')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'A receber' }))
    const select = screen.getByLabelText('Adquirente')
    const opcao = within(select).getAllByRole('option')[1] as HTMLOptionElement
    await user.selectOptions(select, opcao.value)
    for (const row of linhas()) expect(within(row).getByText(opcao.value)).toBeInTheDocument()
  })

  it('clicar numa barra filtra a tabela pela semana', async () => {
    renderPage()
    await screen.findByText('A receber em 90 dias')
    const antes = linhas().length
    const chart = screen.getByRole('img', { name: 'Valor líquido a receber por semana' })
    const alvos = chart.querySelectorAll('rect')
    fireEvent.click(alvos[0])
    const limpar = await screen.findByRole('button', { name: /^Semana de / })
    expect(linhas().length).toBeLessThan(antes)
    expect(screen.getByLabelText('Semana')).not.toHaveValue('')
    fireEvent.click(limpar)
    await waitFor(() => expect(linhas()).toHaveLength(antes))
  })

  it('seleção → barra fixa → simulação com receivable_ids → contratação', async () => {
    const user = userEvent.setup()
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
    const itens = db.recebiveis({}).itens.filter((r) => r.status === 'PREVISTO')
    renderPage()
    await screen.findByText('A receber em 90 dias')
    const [a, b] = [...itens].sort((x, y) => x.vencimento.localeCompare(y.vencimento))
    await user.click(screen.getByRole('checkbox', { name: `Selecionar ${a.id}` }))
    await user.click(screen.getByRole('checkbox', { name: `Selecionar ${b.id}` }))
    const barra = screen.getByRole('region', { name: 'Seleção para antecipação' })
    const liquido = a.valor_liquido + b.valor_liquido
    expect(barra).toHaveTextContent(
      `2 recebíveis · ${money(liquido).replace(/\u00a0/g, ' ')} líquido`,
    )
    await user.click(within(barra).getByRole('button', { name: 'Simular antecipação' }))

    const dialog = await screen.findByRole('dialog', { name: 'Simular antecipação' })
    await waitFor(() => expect(bodies).toHaveLength(1))
    const maximo = Math.floor(liquido * 0.8 * 100) / 100
    expect(bodies[0]).toEqual({
      produto: 'ANTECIPACAO_RECEBIVEIS',
      valor: maximo,
      prazo_meses: 1,
      receivable_ids: [a.id, b.id],
    })
    expect(await within(dialog).findByText('Valor líquido na conta')).toBeInTheDocument()

    // Acima de 80% do líquido: não simula e explica.
    const campo = within(dialog).getByLabelText('Valor a antecipar')
    await user.clear(campo)
    await user.type(campo, String(Math.ceil(liquido)))
    expect(within(dialog).getByText(/80% do líquido selecionado\)/)).toBeInTheDocument()
    await user.clear(campo)
    await user.type(campo, '100')
    await user.click(within(dialog).getByRole('radio', { name: '3x' }))
    await waitFor(() => expect(bodies.at(-1)).toMatchObject({ valor: 100, prazo_meses: 3 }))

    const contratar = within(dialog).getByRole('button', { name: 'Contratar' })
    await waitFor(() => expect(contratar).toBeEnabled())
    await user.click(contratar)
    expect(await within(dialog).findByText('Crédito contratado')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Seleção para antecipação' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('erro ao contratar aparece no painel', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API}/me/credit/requests`, () =>
        HttpResponse.json(
          { error: 'SIMULACAO_JA_UTILIZADA', message: 'Esta simulação já virou uma proposta.' },
          { status: 422 },
        ),
      ),
    )
    renderPage()
    await screen.findByText('A receber em 90 dias')
    await user.click(screen.getAllByRole('checkbox', { name: /^Selecionar \d/ })[0])
    await user.click(screen.getByRole('button', { name: 'Simular antecipação' }))
    const dialog = await screen.findByRole('dialog')
    const contratar = within(dialog).getByRole('button', { name: 'Contratar' })
    await waitFor(() => expect(contratar).toBeEnabled())
    await user.click(contratar)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Esta simulação já virou uma proposta',
    )
  })

  it('recebível já antecipado ao contratar: recarrega a lista e pede nova escolha', async () => {
    const user = userEvent.setup()
    let gets = 0
    server.use(
      http.post(`${API}/me/credit/requests`, () =>
        HttpResponse.json(
          { error: 'RECEBIVEL_INDISPONIVEL', message: 'Recebível 1 não está mais disponível.' },
          { status: 422 },
        ),
      ),
      http.get(`${API}/me/receivables`, () => {
        gets++
        return HttpResponse.json(db.recebiveis({}))
      }),
    )
    renderPage()
    await screen.findByText('A receber em 90 dias')
    await user.click(screen.getAllByRole('checkbox', { name: /^Selecionar \d/ })[0])
    await user.click(screen.getByRole('button', { name: 'Simular antecipação' }))
    const dialog = await screen.findByRole('dialog')
    const contratar = within(dialog).getByRole('button', { name: 'Contratar' })
    await waitFor(() => expect(contratar).toBeEnabled())
    await user.click(contratar)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'já foi recebido ou antecipado',
    )
    await waitFor(() => expect(gets).toBe(2))
    await user.click(within(dialog).getByRole('button', { name: 'Escolher de novo' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Seleção para antecipação' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('recebível indisponível na simulação mostra o erro', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API}/me/credit/simulations`, () =>
        HttpResponse.json(
          { error: 'RECEBIVEL_INDISPONIVEL', message: 'Recebível 1 não está mais disponível.' },
          { status: 422 },
        ),
      ),
    )
    renderPage()
    await screen.findByText('A receber em 90 dias')
    await user.click(screen.getAllByRole('checkbox', { name: /^Selecionar \d/ })[0])
    await user.click(screen.getByRole('button', { name: 'Simular antecipação' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/já foi recebido ou antecipado/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('o insight seleciona todos os recebíveis a receber; limpar zera a seleção', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Selecionar recebíveis/ }))
    const barra = screen.getByRole('region', { name: 'Seleção para antecipação' })
    const previstos = db.recebiveis({}).itens.filter((r) => r.status === 'PREVISTO')
    expect(barra).toHaveTextContent(`${previstos.length} recebíveis`)
    await user.click(within(barra).getByRole('button', { name: 'Limpar' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Seleção para antecipação' }),
      ).not.toBeInTheDocument(),
    )
    // Selecionar todos pelo cabeçalho e desmarcar de novo.
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    expect(screen.getByRole('region', { name: 'Seleção para antecipação' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Seleção para antecipação' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('filtro sem resultados ensina a limpar', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/me/receivables`, () =>
        HttpResponse.json({
          itens: [
            {
              id: 1,
              vencimento: '2099-01-10',
              valor_bruto: 100,
              valor_liquido: 97,
              adquirente: 'Stone',
              status: 'PREVISTO',
            },
          ],
          total_previsto: 97,
          por_semana: [],
        }),
      ),
    )
    renderPage()
    await screen.findByText('A receber em 90 dias')
    expect(screen.getByText('Nada a receber nas próximas semanas.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Antecipados' }))
    expect(screen.getByText('Nada com esses filtros')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  })

  it('agenda vazia: estado que ensina', async () => {
    server.use(
      http.get(`${API}/me/receivables`, () =>
        HttpResponse.json({ itens: [], total_previsto: 0, por_semana: [] }),
      ),
    )
    renderPage()
    expect(await screen.findByText('Nenhum recebível na agenda')).toBeInTheDocument()
  })

  it('erro com nova tentativa', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API}/me/receivables`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('A receber em 90 dias')).toBeInTheDocument()
  })
})

describe('ReceivablesPage com cadastro pendente', () => {
  useMockApi('EM_ANALISE')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('explica que a agenda abre depois da aprovação', async () => {
    renderPage()
    expect(await screen.findByText('Seu cadastro ainda está em análise')).toBeInTheDocument()
  })
})
