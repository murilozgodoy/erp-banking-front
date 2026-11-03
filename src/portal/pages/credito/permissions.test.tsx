import { useAuth0 } from '@auth0/auth0-react'
import { configure, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import * as db from '../../mocks/db'
import { setMembroLogado } from '../../mocks/team'
import { renderPortal, useMockApi } from '../../test/portal'
import { CreditPage } from './CreditPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 30_000 })

const API = env.transactionsApiUrl

function renderCredit() {
  return renderPortal(<CreditPage />, { route: '/app/credito', path: '/app/credito' })
}

/** Uma proposta que o Rafael (só pede crédito) deixou aguardando contratação. */
function propostaAguardando() {
  setMembroLogado('FINANCEIRO')
  const sim = db.simularCredito({ produto: 'CAPITAL_DE_GIRO', valor: 5000, prazo_meses: 6 })
  if (sim.tipo !== 'ok') throw new Error('simulação falhou')
  const pedido = db.solicitarCredito({ simulation_id: sim.simulation.id })
  if (pedido.tipo !== 'ok') throw new Error('pedido falhou')
  return pedido.request
}

describe('Crédito com permissões (seção 11)', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => setMembroLogado(null))

  it('leitura: não simula e o botão fica travado com o motivo', async () => {
    setMembroLogado('LEITURA')
    let simulou = false
    server.use(
      http.post(`${API}/me/credit/simulations`, () => {
        simulou = true
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderCredit()
    const simular = await screen.findByRole('button', { name: 'Simular' })
    expect(simular).toHaveAttribute('aria-disabled', 'true')
    expect(simular).toHaveAccessibleDescription(
      'Peça a um administrador a permissão de pedir crédito.',
    )
    expect(screen.getByText(/simular e contratar crédito pede a permissão/)).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(simulou).toBe(false)
  })

  it('só pedir crédito: envia a proposta para contratação', async () => {
    setMembroLogado('FINANCEIRO')
    const user = userEvent.setup()
    renderCredit()
    const enviar = await screen.findByRole('button', { name: 'Enviar proposta para contratação' })
    expect(screen.getByText(/Quem tem a permissão de contratar crédito confirma/)).toBeVisible()
    await user.click(enviar)
    const sheet = await screen.findByRole('dialog', { name: 'Enviar proposta' })
    await user.click(
      within(sheet).getByRole('button', { name: 'Enviar proposta para contratação' }),
    )
    expect(await within(sheet).findByText('Proposta enviada para contratação')).toBeVisible()
    await user.click(within(sheet).getByRole('button', { name: 'Concluir' }))

    const propostas = screen.getByRole('region', { name: 'Propostas e contratos' })
    expect(await within(propostas).findByText('Aguardando contratação')).toBeInTheDocument()
    expect(within(propostas).getAllByText('feito por Rafael Lima').length).toBeGreaterThan(0)
    const contratar = within(propostas).getByRole('button', { name: /Contratar a proposta/ })
    expect(contratar).toHaveAttribute('aria-disabled', 'true')
  })

  it('quem contrata confirma a proposta aguardando na linha', async () => {
    const request = propostaAguardando()
    setMembroLogado('DONO')
    const user = userEvent.setup()
    renderCredit()
    const propostas = await screen.findByRole('region', { name: 'Propostas e contratos' })
    expect(await within(propostas).findByRole('note')).toHaveTextContent(
      'Revise e contrate na linha da proposta.',
    )
    await user.click(
      within(propostas).getByRole('button', { name: `Contratar a proposta nº ${request.id}` }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Contratar proposta' })
    expect(within(sheet).getByText('Rafael Lima')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Confirmar contratação' }))
    expect(await within(sheet).findByText('Crédito contratado')).toBeVisible()
    await user.click(within(sheet).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(within(propostas).queryByText('Aguardando contratação')).toBeNull())
  })

  it('erro ao confirmar e 403 de permissão viram mensagens claras', async () => {
    const request = propostaAguardando()
    setMembroLogado('DONO')
    server.use(
      http.post(`${API}/me/credit/requests/:id/confirm`, () =>
        HttpResponse.json({ error: 'PEDIDO_NAO_AGUARDANDO_CONTRATACAO' }, { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderCredit()
    const propostas = await screen.findByRole('region', { name: 'Propostas e contratos' })
    await user.click(
      await within(propostas).findByRole('button', {
        name: `Contratar a proposta nº ${request.id}`,
      }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Contratar proposta' })
    await user.click(within(sheet).getByRole('button', { name: 'Confirmar contratação' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(/já foi contratada/)
    await user.click(within(sheet).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    server.use(
      http.post(`${API}/me/credit/requests/:id/confirm`, () =>
        HttpResponse.json(
          { error: 'SEM_PERMISSAO', permissao: 'contratar_credito' },
          { status: 403 },
        ),
      ),
    )
    await user.click(
      within(propostas).getByRole('button', { name: `Contratar a proposta nº ${request.id}` }),
    )
    const outra = await screen.findByRole('dialog', { name: 'Contratar proposta' })
    await user.click(within(outra).getByRole('button', { name: 'Confirmar contratação' }))
    expect(await within(outra).findByRole('alert')).toHaveTextContent(
      /não permite contratar crédito/,
    )
  })
})
