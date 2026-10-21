import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useApi } from '@/hooks/useApi'
import { fakeApi } from '@/test/api'
import { auth0State } from '@/test/auth0'
import { customer } from '@/test/fixtures'
import { renderPage } from '@/test/render'

import { NewCustomerPage } from './NewCustomerPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.mock('@/hooks/useApi', () => ({ useApi: vi.fn() }))

let api: ReturnType<typeof fakeApi>

beforeEach(() => {
  api = fakeApi()
  vi.mocked(useApi).mockReturnValue(api)
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['write:customers'] }))
})

async function fillForm() {
  const user = userEvent.setup()
  const values: [string, string][] = [
    ['Nome completo', ' Maria Souza '],
    ['CPF', '987.654.321-00'],
    ['E-mail', 'maria@example.com'],
    ['Telefone', '(11) 98888-7777'],
    ['Rua', 'Av. Paulista'],
    ['Número', '1000'],
    ['Cidade', 'São Paulo'],
    ['UF', 'sp'],
    ['CEP', '01310-100'],
    ['Renda mensal (R$)', '12000'],
    ['Patrimônio (R$)', '250000'],
    ['Ocupação', 'PJ'],
  ]
  for (const [label, value] of values) {
    await user.type(await screen.findByLabelText(label), value)
  }
  await user.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
}

describe('NewCustomerPage', () => {
  it('cadastra com dados normalizados e abre a ficha do cliente', async () => {
    api.customers.create.mockResolvedValue(customer({ id: 42 }))
    renderPage(<NewCustomerPage />, { route: '/clientes/novo', path: '/clientes/novo' })

    await fillForm()

    expect(api.customers.create).toHaveBeenCalledWith({
      nome: 'Maria Souza',
      cpf: '98765432100',
      email: 'maria@example.com',
      telefone: '11988887777',
      address: {
        rua: 'Av. Paulista',
        numero: '1000',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310100',
      },
      financial_profile: { renda_mensal: 12000, patrimonio: 250000, ocupacao: 'PJ' },
    })
    expect(await screen.findByTestId('location')).toHaveTextContent('/clientes/42')
  })

  it('mostra o conflito de CPF devolvido pela API', async () => {
    const config = { headers: new AxiosHeaders() }
    const response = {
      status: 409,
      data: { detail: 'CPF 98765432100 já cadastrado' },
      config,
    } as AxiosResponse
    api.customers.create.mockRejectedValue(
      new AxiosError('conflict', 'ERR_BAD_REQUEST', config, null, response),
    )
    renderPage(<NewCustomerPage />, { route: '/clientes/novo', path: '/clientes/novo' })

    await fillForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('CPF 98765432100 já cadastrado')
    expect(screen.getByLabelText('Nome completo')).toHaveValue(' Maria Souza ')
  })
})
