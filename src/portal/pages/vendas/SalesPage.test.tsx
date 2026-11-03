import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { vendas } from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import type { SalesReport } from '../../types'

import { windows } from './period'
import { SalesPage } from './SalesPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const SALES = 'http://transactions.test/me/sales'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.search}</p>
}

function renderSales(route = '/app/vendas') {
  return renderPortal(
    <>
      <SalesPage />
      <Where />
    </>,
    { route, path: '/app/vendas' },
  )
}

function fixture(total: number, overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    serie: [
      { periodo: '2026-10-31', valor: total * 0.4, quantidade: 4 },
      { periodo: '2026-11-01', valor: total * 0.6, quantidade: 6 },
    ],
    por_forma_pagamento: [
      { forma: 'CARTAO_CREDITO', valor: total * 0.5, pct: 50 },
      { forma: 'PIX', valor: total * 0.5, pct: 50 },
    ],
    por_canal: [{ canal: 'Loja', valor: total, pct: 100 }],
    top_produtos: [
      { sku: 'PAO-01', nome: 'Pão francês', valor: total * 0.6, quantidade: 3 },
      { sku: 'BOL-02', nome: 'Bolo de cenoura', valor: total * 0.3, quantidade: 9 },
    ],
    total,
    ticket_medio: total / 10,
    ...overrides,
  }
}

/** Responde com o mock real e guarda os parâmetros de cada chamada. */
function recordSales(server: ReturnType<typeof useMockApi>) {
  const calls: URLSearchParams[] = []
  server.use(
    http.get(SALES, ({ request }) => {
      const q = new URL(request.url).searchParams
      calls.push(q)
      return HttpResponse.json(
        vendas({ from: q.get('from'), to: q.get('to'), group_by: q.get('group_by') }),
      )
    }),
  )
  return calls
}

/** Janela atual responde `current`, a anterior responde `previous`. */
function serveWindows(
  server: ReturnType<typeof useMockApi>,
  current: SalesReport,
  previous: SalesReport,
) {
  const { current: now } = windows('30d')
  server.use(
    http.get(SALES, ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get('from') === now.from ? current : previous,
      ),
    ),
  )
}

describe('SalesPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: ['read:self', 'write:self'] }) as never,
    )
  })

  it('mostra resumo, insight com antecipação, gráfico, mix e produtos', async () => {
    renderSales()
    expect(screen.getByRole('heading', { name: 'Vendas', level: 1 })).toBeInTheDocument()

    expect(await screen.findByText('Faturamento do período')).toBeInTheDocument()
    expect(await screen.findAllByText(/vs\. 30 dias anteriores/)).toHaveLength(4)
    expect(screen.getByText('Ticket médio')).toBeInTheDocument()
    expect(screen.getByText('Média diária')).toBeInTheDocument()

    const insight = await screen.findByRole('complementary', { name: 'Insight da ErpIa' })
    expect(within(insight).getByText('Delivery cresce')).toBeInTheDocument()
    const simular = within(insight).getByRole('link', { name: /Simular antecipação/ })
    expect(simular.getAttribute('href')).toMatch(
      /^\/app\/credito\?produto=ANTECIPACAO_RECEBIVEIS&valor=\d+$/,
    )
    expect(within(insight).getByText(/das suas vendas são no cartão de crédito/)).toBeVisible()

    expect(screen.getByRole('heading', { name: 'Faturamento por dia' })).toBeInTheDocument()
    expect(screen.getByText(/^Melhor dia:/)).toBeInTheDocument()
    expect(screen.getByText(/fins de semana somam/)).toBeInTheDocument()

    const formas = screen.getByRole('region', { name: 'Formas de pagamento' })
    for (const label of ['PIX', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro']) {
      expect(within(formas).getByText(label)).toBeInTheDocument()
    }
    expect(within(formas).getByRole('link', { name: /Ver recebíveis/ })).toHaveAttribute(
      'href',
      '/app/recebiveis',
    )
    const canais = screen.getByRole('region', { name: 'Canais' })
    expect(within(canais).getByText('iFood')).toBeInTheDocument()

    const tabela = screen.getByRole('table', { name: 'Produtos mais vendidos no período' })
    expect(within(tabela).getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('troca período e agrupamento: refaz a busca com os parâmetros certos e grava na URL', async () => {
    const calls = recordSales(server)
    renderSales()
    await screen.findByText('Faturamento do período')
    const thirty = windows('30d')
    expect(calls.some((q) => q.get('from') === thirty.current.from)).toBe(true)
    expect(calls.some((q) => q.get('from') === thirty.previous.from)).toBe(true)
    expect(calls.every((q) => q.get('group_by') === 'day')).toBe(true)
    expect(screen.queryByRole('radio', { name: 'Mês' })).not.toBeInTheDocument()

    const user = userEvent.setup()
    calls.length = 0
    await user.click(screen.getByRole('radio', { name: '90d' }))
    const ninety = windows('90d')
    await waitFor(() =>
      expect(
        calls.find(
          (q) => q.get('from') === ninety.current.from && q.get('to') === ninety.current.to,
        ),
      ).toBeDefined(),
    )
    expect(calls.find((q) => q.get('from') === ninety.previous.from)?.get('group_by')).toBe('week')
    expect(screen.getByTestId('where')).toHaveTextContent('?periodo=90d')
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveAttribute('aria-checked', 'true')
    expect(
      await screen.findByRole('heading', { name: 'Faturamento por semana' }),
    ).toBeInTheDocument()

    calls.length = 0
    await user.click(screen.getByRole('radio', { name: 'Mês' }))
    await waitFor(() => expect(calls.some((q) => q.get('group_by') === 'month')).toBe(true))
    expect(screen.getByTestId('where')).toHaveTextContent('?periodo=90d&agrupar=mes')
    expect(await screen.findByRole('heading', { name: 'Faturamento por mês' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: '30d' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^$/)
  })

  it('lê a seleção da URL e usa linha para série diária longa', async () => {
    const calls = recordSales(server)
    renderSales('/app/vendas?periodo=120d&agrupar=dia')
    expect(screen.getByRole('radio', { name: '120d' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true')
    expect(await screen.findByRole('heading', { name: 'Faturamento por dia' })).toBeInTheDocument()
    expect(calls[0].get('from')).toBe(windows('120d').current.from)
    // A série de 120 dias vira linha (gráfico focável pelo teclado).
    const chart = screen.getByRole('img', { name: 'Faturamento por dia' })
    expect(chart).toHaveAttribute('tabindex', '0')
    chart.focus()
    await userEvent.setup().keyboard('{ArrowRight}')
    expect(await screen.findByText(/^[\d.]+ vendas?$/)).toBeInTheDocument()
    // O mock só tem 120 dias de histórico: a janela anterior não serve de base.
    expect(await screen.findAllByText('sem histórico para comparar')).toHaveLength(4)
  })

  it('compara com o período anterior equivalente', async () => {
    serveWindows(server, fixture(1200), fixture(1000))
    renderSales()
    // Faturamento, ticket médio e média diária sobem 20%; o número de vendas fica igual.
    expect(await screen.findAllByText('+20,0%')).toHaveLength(3)
    expect(screen.getByText('0,0%')).toBeInTheDocument()
    expect(screen.getAllByText('vs. 30 dias anteriores')).toHaveLength(4)
  })

  it('ordena a tabela de produtos pelo cabeçalho', async () => {
    serveWindows(server, fixture(1000), fixture(1000))
    renderSales()
    const tabela = await screen.findByRole('table', { name: 'Produtos mais vendidos no período' })
    const firstProduct = () => within(within(tabela).getAllByRole('row')[1]).getByText(/Pão|Bolo/)
    expect(firstProduct()).toHaveTextContent('Pão francês')
    expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent('60,0%')

    const user = userEvent.setup()
    await user.click(within(tabela).getByRole('button', { name: /Quantidade/ }))
    expect(firstProduct()).toHaveTextContent('Bolo de cenoura')
    expect(within(tabela).getByRole('columnheader', { name: /Quantidade/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    await user.click(within(tabela).getByRole('button', { name: /Quantidade/ }))
    expect(firstProduct()).toHaveTextContent('Pão francês')
  })

  it('período sem vendas ensina e sugere um período maior', async () => {
    serveWindows(server, fixture(0, { serie: [], top_produtos: [] }), fixture(0))
    renderSales()
    expect(await screen.findByText('Nenhuma venda nos últimos 30 dias')).toBeInTheDocument()
    expect(screen.getByText(/As vendas chegam do seu ERP/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver últimos 90 dias' }))
    expect(screen.getByTestId('where')).toHaveTextContent('?periodo=90d')
  })

  it('erro com nova tentativa', async () => {
    server.use(http.get(SALES, () => HttpResponse.json({}, { status: 500 }), { once: true }))
    server.use(http.get(SALES, () => HttpResponse.json({}, { status: 500 }), { once: true }))
    renderSales()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos carregar esta área')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Faturamento do período')).toBeInTheDocument()
  })

  it('cadastro pendente (409) leva ao andamento da análise', async () => {
    server.use(
      http.get(SALES, () =>
        HttpResponse.json({ error: 'ONBOARDING_PENDENTE', status: 'EM_ANALISE' }, { status: 409 }),
      ),
    )
    renderSales()
    expect(
      await screen.findByText('Suas vendas aparecem quando o cadastro for aprovado'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver andamento do cadastro' })).toHaveAttribute(
      'href',
      '/app/status',
    )
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
