import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import { isoDay } from '../../lib/format'
import { setMockStatus } from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import type { Pendencia } from '../../types'

import { agrupar, quando, soma } from './pendencias'
import { PendenciasPage } from './PendenciasPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const url = (path: string) => `${env.transactionsApiUrl}${path}`

function pendencia(overrides: Partial<Pendencia>): Pendencia {
  return {
    id: 'payable-1',
    tipo: 'CONTA_ATRASADA',
    titulo: 'Fornecedor atrasado',
    descricao: 'Juros estimados.',
    valor: 100,
    data: '2026-10-28',
    acao: { label: 'Pagar agora', rota: '/app/pagamentos?conta=1' },
    ...overrides,
  }
}

function open() {
  return renderPortal(<PendenciasPage />, { route: '/app/pendencias', path: '/app/pendencias' })
}

describe('PendenciasPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('mostra o resumo, o insight e a fila agrupada por urgência com ações e crédito', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Pendências' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Carregando as pendências…' })).toBeInTheDocument()

    const agora = await screen.findByRole('region', { name: 'Resolver agora' })
    expect(screen.getByText('Em atraso')).toBeInTheDocument()
    expect(screen.getByText('Pendências abertas')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Crédito' })).toBeInTheDocument()

    const pagar = within(agora).getAllByRole('link', { name: 'Pagar agora' })[0]
    expect(pagar.getAttribute('href')).toMatch(/^\/app\/pagamentos\?conta=\d+$/)
    expect(within(agora).getAllByText('Atrasada').length).toBeGreaterThan(0)
    expect(within(agora).getAllByText(/^venceu .* · há \d+ dias$/).length).toBeGreaterThan(0)

    const antecipar = within(agora)
      .getAllByRole('link', { name: /Simular/ })
      .find((link) => link.getAttribute('href')?.includes('ANTECIPACAO_RECEBIVEIS'))
    expect(antecipar?.getAttribute('href')).toMatch(
      /^\/app\/credito\?produto=ANTECIPACAO_RECEBIVEIS&valor=\d+$/,
    )

    // Proposta em revisão (como o back gera: credit-request-{id}) leva ao acompanhamento.
    const credito = screen.getByRole('region', { name: 'Crédito' })
    expect(within(credito).getByRole('link', { name: /Acompanhar/ })).toHaveAttribute(
      'href',
      '/app/credito',
    )

    const insight = await screen.findByRole('complementary', { name: 'Insight da ErpIa' })
    expect(within(insight).getByText('Fornecedor em atraso')).toBeInTheDocument()
  })

  it('filtra por grupo', async () => {
    open()
    const user = userEvent.setup()
    await screen.findByRole('region', { name: 'Resolver agora' })
    await user.click(screen.getByRole('radio', { name: /^Estoque/ }))
    expect(screen.getByRole('region', { name: 'Estoque' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Resolver agora' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Todas/ }))
    expect(screen.getByRole('region', { name: 'Resolver agora' })).toBeInTheDocument()
  })

  it('ensina quando um grupo filtrado está vazio', async () => {
    server.use(http.get(url('/me/pendencias'), () => HttpResponse.json([pendencia({})])))
    open()
    const user = userEvent.setup()
    await screen.findByRole('region', { name: 'Resolver agora' })
    expect(screen.getByText('1 conta')).toBeInTheDocument()
    expect(screen.getByText('Nada vence hoje')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Crédito/ }))
    expect(screen.getByText('Nada neste grupo')).toBeInTheDocument()
  })

  it('mostra um estado vazio calmo quando não há pendências', async () => {
    server.use(http.get(url('/me/pendencias'), () => HttpResponse.json([])))
    open()
    expect(await screen.findByText('Tudo em dia')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver a visão geral' })).toHaveAttribute('href', '/app')
  })

  it('mostra erro com nova tentativa', async () => {
    server.use(
      http.get(url('/me/pendencias'), () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    open()
    const user = userEvent.setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não conseguimos carregar as pendências',
    )
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Resolver agora' })).toBeInTheDocument()
  })

  it('explica quando o cadastro ainda está em análise (409)', async () => {
    setMockStatus('ANALISE_MANUAL')
    open()
    expect(await screen.findByText('Seu cadastro ainda está em análise')).toBeInTheDocument()
  })
})

describe('pendencias helpers', () => {
  const today = new Date(2026, 10, 3)

  it('agrupa na ordem de urgência e descreve a data pelo tipo', () => {
    const lista = [
      pendencia({ id: 'inventory-idle-1', tipo: 'ESTOQUE_PARADO', data: isoDay(today) }),
      pendencia({ id: 'payable-2', tipo: 'VENCE_HOJE', data: isoDay(today) }),
      pendencia({ id: 'saldo-insuficiente', tipo: 'SALDO_INSUFICIENTE', data: '2026-11-21' }),
      pendencia({ id: 'payable-1' }),
    ]
    const [agora, credito, estoque] = agrupar(lista)
    expect(agora.itens.map((p) => p.id)).toEqual(['payable-1', 'saldo-insuficiente', 'payable-2'])
    expect(credito.itens).toHaveLength(0)
    expect(estoque.itens).toHaveLength(1)

    expect(quando(lista[3], today)).toBe('venceu 28 out · há 6 dias')
    expect(quando(lista[1], today)).toBe('vence hoje')
    expect(quando(lista[2], today)).toBe('a partir de 21 nov · em 18 dias')
    expect(quando({ ...lista[2], data: isoDay(today) }, today)).toBe('a partir de hoje')
    expect(quando(lista[0], today)).toBe('hoje')
    expect(quando({ ...lista[0], data: '2026-11-01' }, today)).toBe('01 nov · há 2 dias')
    expect(soma(lista, 'CONTA_ATRASADA')).toEqual({ total: 100, qtd: 1 })
  })
})
