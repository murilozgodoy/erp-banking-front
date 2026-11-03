import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Permission } from '@/auth/permissions'
import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { account, credit, customer } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { CUSTOMERS_PAGE_LIMIT, HomeIndicators } from './HomeIndicators'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
})

function renderWith(permissions: Permission[]) {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions }))
  return renderPage(<HomeIndicators />)
}

describe('HomeIndicators', () => {
  it('mostra clientes, contas e créditos por status', async () => {
    api.customers.list.mockResolvedValue([
      customer(),
      customer({
        id: 2,
        anamnesis: { id: 1, dividas_ativas: 0, comprometimento_renda: 10, updated_at: '' },
      }),
    ])
    api.accounts.list.mockResolvedValue([
      account({ saldo: 1000 }),
      account({ id: 6, saldo: 500, status: 'BLOCKED' }),
    ])
    api.credits.list.mockResolvedValue([
      credit({ valorAprovado: 10000 }),
      credit({ id: 8, status: 'NEGADO', valorAprovado: 0 }),
      credit({ id: 9, status: 'REVISAO', valorAprovado: 0 }),
    ])
    renderWith(['read:customers', 'read:accounts', 'read:credits'])

    const customers = await screen.findByRole('region', { name: 'Clientes cadastrados' })
    expect(await within(customers).findByText('2')).toBeInTheDocument()
    expect(within(customers).getByText('1 com anamnese')).toBeInTheDocument()
    expect(api.customers.list).toHaveBeenCalledWith({ limit: CUSTOMERS_PAGE_LIMIT })

    const accounts = screen.getByRole('region', { name: 'Contas' })
    expect(
      await within(accounts).findByText(/1 ativas · saldo total R\$\s1\.500,00/),
    ).toBeInTheDocument()

    const credits = screen.getByRole('region', { name: 'Pedidos de crédito' })
    expect(await within(credits).findByText('3')).toBeInTheDocument()
    expect(within(credits).getByText(/R\$\s10\.000,00 aprovados/)).toBeInTheDocument()
    expect(within(credits).getByText('Aprovados: 1')).toBeInTheDocument()
    expect(within(credits).getByText('Negados: 1')).toBeInTheDocument()
    expect(within(credits).getByText('Em revisão: 1')).toBeInTheDocument()
  })

  it('indica quando há mais clientes que a página e créditos vazios', async () => {
    api.customers.list.mockResolvedValue(
      Array.from({ length: CUSTOMERS_PAGE_LIMIT }, (_, i) => customer({ id: i + 1 })),
    )
    api.credits.list.mockResolvedValue([])
    renderWith(['read:customers', 'read:credits'])

    expect(await screen.findByText(`${CUSTOMERS_PAGE_LIMIT}+`)).toBeInTheDocument()
    expect(await screen.findByText('Aprovados: 0')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Contas' })).not.toBeInTheDocument()
  })

  it('mostra erro por indicador', async () => {
    api.accounts.list.mockRejectedValue(new Error('falhou'))
    renderWith(['read:accounts'])

    expect(await screen.findByRole('alert')).toHaveTextContent('falhou')
  })

  it('não renderiza nada sem permissões de leitura', async () => {
    const { container } = renderWith(['write:scores'])

    await vi.waitFor(() => expect(container.textContent).toBe(''))
  })
})
