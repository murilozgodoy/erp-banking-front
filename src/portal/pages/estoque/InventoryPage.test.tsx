import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import { setMockStatus } from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import type { InventoryItem, InventoryReport } from '../../types'

import { custoReposicao, filtrar, porFaixaDeGiro } from './inventory'
import { InventoryPage } from './InventoryPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const url = (path: string) => `${env.transactionsApiUrl}${path}`

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    sku: 'SKU-1',
    nome: 'Item',
    quantidade: 10,
    minimo: 5,
    custo_unitario: 10,
    preco_venda: 20,
    giro_dias: 20,
    ultima_venda: '2026-11-01',
    cobertura_dias: 30,
    abaixo_minimo: false,
    parado: false,
    ...overrides,
  }
}

function open(route = '/app/estoque') {
  return renderPortal(<InventoryPage />, { route, path: '/app/estoque' })
}

describe('InventoryPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('mostra indicadores, insight com financiamento de estoque e a tabela de itens', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Carregando o estoque…' })).toBeInTheDocument()

    const table = await screen.findByRole('table', { name: /Itens de estoque/ })
    expect(screen.getByText('Valor em estoque')).toBeInTheDocument()
    expect(screen.getByText('Valor parado')).toBeInTheDocument()
    expect(screen.getByText('Cobertura média')).toBeInTheDocument()
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5)
    expect(within(table).getAllByText('Abaixo do mínimo').length).toBeGreaterThan(0)

    const insight = await screen.findByRole('complementary', { name: 'Insight da ErpIa' })
    expect(within(insight).getByText('Dinheiro parado na prateleira')).toBeInTheDocument()
    const simular = await within(insight).findByRole('link', { name: /Simular financiamento/ })
    expect(simular.getAttribute('href')).toMatch(
      /^\/app\/credito\?produto=FINANCIAMENTO_ESTOQUE&valor=\d+$/,
    )
    expect(within(insight).getByText(/abaixo do mínimo custa/)).toBeInTheDocument()

    expect(
      screen.getByRole('img', { name: 'Valor em estoque a custo por faixa de giro' }),
    ).toBeInTheDocument()
  })

  it('filtra por abaixo do mínimo e parados, e ordena pelas colunas', async () => {
    open()
    const user = userEvent.setup()
    const table = await screen.findByRole('table', { name: /Itens de estoque/ })
    const total = within(table).getAllByRole('row').length

    await user.click(screen.getByRole('radio', { name: /Abaixo do mínimo/ }))
    let rows = within(screen.getByRole('table', { name: /Itens de estoque/ }))
      .getAllByRole('row')
      .slice(1)
    expect(rows.length).toBeLessThan(total - 1)
    for (const row of rows) expect(within(row).getByText('Abaixo do mínimo')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Parados/ }))
    rows = within(screen.getByRole('table', { name: /Itens de estoque/ }))
      .getAllByRole('row')
      .slice(1)
    for (const row of rows) expect(within(row).getByText('Parado')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Todos' }))
    await user.click(screen.getByRole('button', { name: 'Cobertura' }))
    expect(screen.getByRole('columnheader', { name: 'Cobertura' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('destaca o item vindo de uma pendência e permite limpar', async () => {
    open('/app/estoque?sku=CESTA-VIME')
    const user = userEvent.setup()
    expect(await screen.findByText(/Destacando/)).toHaveTextContent('Cesta de vime')
    await user.click(screen.getByRole('button', { name: 'Limpar destaque' }))
    await waitFor(() => expect(screen.queryByText(/Destacando/)).not.toBeInTheDocument())
  })

  it('ensina no filtro vazio', async () => {
    const report: InventoryReport = {
      itens: [item({ sku: 'A', nome: 'Café' })],
      valor_total: 100,
      valor_parado: 0,
      abaixo_minimo: 0,
      cobertura_media_dias: 30,
    }
    server.use(http.get(url('/me/inventory'), () => HttpResponse.json(report)))
    open()
    const user = userEvent.setup()
    await screen.findByRole('table', { name: /Itens de estoque/ })
    expect(screen.getByText('Todo o estoque gira em até 90 dias.')).toBeInTheDocument()
    expect(screen.getByText('Tudo no nível de reposição')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Parados/ }))
    expect(await screen.findByText('Nenhum item parado')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Abaixo do mínimo/ }))
    expect(await screen.findByText('Nenhum item abaixo do mínimo')).toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há itens', async () => {
    server.use(
      http.get(url('/me/inventory'), () =>
        HttpResponse.json({
          itens: [],
          valor_total: 0,
          valor_parado: 0,
          abaixo_minimo: 0,
          cobertura_media_dias: 0,
        }),
      ),
    )
    open()
    expect(await screen.findByText('Nenhum item de estoque ainda')).toBeInTheDocument()
  })

  it('mostra erro com nova tentativa', async () => {
    server.use(
      http.get(url('/me/inventory'), () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    open()
    const user = userEvent.setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos carregar o estoque')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table', { name: /Itens de estoque/ })).toBeInTheDocument()
  })

  it('explica quando o cadastro ainda está em análise (409)', async () => {
    setMockStatus('EM_ANALISE')
    open()
    expect(await screen.findByText('Seu cadastro ainda está em análise')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver andamento da análise' })).toHaveAttribute(
      'href',
      '/app/status',
    )
  })
})

describe('inventory helpers', () => {
  it('calcula reposição, filtros e faixas de giro', () => {
    const baixo = item({ sku: 'B', quantidade: 2, minimo: 6, abaixo_minimo: true })
    const parado = item({ sku: 'P', giro_dias: 150, parado: true })
    expect(custoReposicao(baixo)).toBe(40)
    expect(custoReposicao(parado)).toBe(0)
    expect(filtrar([baixo, parado], 'abaixo')).toEqual([baixo])
    expect(filtrar([baixo, parado], 'parados')).toEqual([parado])
    const faixas = porFaixaDeGiro([baixo, parado])
    expect(faixas.find((f) => f.key === 'ate-30')).toMatchObject({ itens: 1, valor: 20 })
    expect(faixas.find((f) => f.key === 'acima-120')).toMatchObject({
      itens: 1,
      valor: 100,
      parado: true,
    })
  })
})
