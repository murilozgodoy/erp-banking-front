import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { money } from '../../lib/format'
import * as db from '../../mocks/db'
import { setMembroLogado } from '../../mocks/team'
import { renderPortal, useMockApi } from '../../test/portal'
import { PaymentsPage } from './PaymentsPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.setConfig({ testTimeout: 30_000 })

const T = 'http://transactions.test'
const brl = (value: number) => money(value).replace(/\s/g, ' ')

function renderPage() {
  return renderPortal(<PaymentsPage />, { route: '/app/pagamentos', path: '/app/pagamentos' })
}

/** Cria um pagamento pendente como outra pessoa (e volta ao papel do teste). */
function pendenteDe(papel: 'OPERADOR' | 'FINANCEIRO', valor: number, destinatario: string) {
  setMembroLogado(papel)
  const resultado = db.pagar({ tipo: 'PIX', valor, destinatario, descricao: 'Compra' })
  if (resultado.tipo !== 'ok') throw new Error('falhou ao criar pendente')
  return resultado.resposta
}

describe('Pagamentos com permissões (seção 11)', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => setMembroLogado(null))

  it('operador acima do limite: avisa antes, envia para aprovação e mostra o pendente', async () => {
    setMembroLogado('OPERADOR')
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Novo pagamento' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo pagamento' })
    expect(within(dialog).getByText(/Seu limite por pagamento é/)).toHaveTextContent(brl(2000))
    await user.type(within(dialog).getByLabelText(/Nome de quem recebe/), 'Moinho Paulista')
    await user.type(within(dialog).getByLabelText(/Chave PIX/), 'moinho@exemplo.com')
    await user.type(within(dialog).getByLabelText(/^Valor/), '3000')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))

    const nota = await within(dialog).findByRole('note')
    expect(nota).toHaveTextContent(
      `Acima do seu limite de ${brl(2000)}: o pagamento fica aguardando aprovação e nada é debitado agora.`,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await within(dialog).findByText('Enviado para aprovação')).toBeInTheDocument()
    expect(within(dialog).getByText('Pendente de aprovação')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Autenticação/)).not.toBeInTheDocument()

    const historico = screen.getByRole('region', { name: 'Histórico de pagamentos' })
    expect(await within(historico).findByText('Pendente de aprovação')).toBeInTheDocument()
    expect(within(historico).getAllByText(/feito por Júlia Santos/).length).toBeGreaterThan(0)
    // Sem aprovar_pagamentos, nada de bandeja.
    expect(screen.queryByRole('region', { name: /Aguardando aprovação/ })).not.toBeInTheDocument()
  })

  it('leitura: pagar, novo pagamento e capital de giro ficam travados com o motivo', async () => {
    setMembroLogado('LEITURA')
    const user = userEvent.setup()
    renderPage()
    const contas = await screen.findByRole('region', { name: 'Contas a pagar' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Novo pagamento' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    const pagar = await within(contas).findAllByRole('button', { name: /^Pagar / })
    expect(pagar[0]).toHaveAttribute('aria-disabled', 'true')
    expect(pagar[0]).toHaveAccessibleDescription('Peça a um administrador a permissão de pagar.')
    await user.click(screen.getByRole('button', { name: 'Novo pagamento' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bandeja: aprova (com comprovante), rejeita com motivo e não deixa aprovar o próprio', async () => {
    const user = userEvent.setup()
    pendenteDe('OPERADOR', 3000, 'Moinho Paulista')
    pendenteDe('OPERADOR', 2500, 'Embalagens Sul')
    pendenteDe('FINANCEIRO', 25_000, 'Forno Industrial')
    setMembroLogado('FINANCEIRO')
    renderPage()

    const bandeja = await screen.findByRole('region', { name: /Aguardando aprovação/ })
    expect(await within(bandeja).findByText('Moinho Paulista')).toBeInTheDocument()
    expect(within(bandeja).getAllByText(/feito por Júlia Santos/)).toHaveLength(2)
    expect(within(bandeja).getByText('Você enviou: outra pessoa precisa aprovar')).toBeVisible()
    expect(
      within(bandeja).queryByRole('button', { name: /Aprovar pagamento .* Forno Industrial/ }),
    ).not.toBeInTheDocument()

    await user.click(
      within(bandeja).getByRole('button', { name: /Aprovar pagamento .* Moinho Paulista/ }),
    )
    const recibo = await screen.findByRole('dialog', { name: 'Pagamento aprovado' })
    expect(within(recibo).getByText('Pagamento efetivado')).toBeInTheDocument()
    expect(within(recibo).getByText('Autenticação')).toBeInTheDocument()
    await user.click(within(recibo).getByRole('button', { name: 'Concluir' }))
    expect(within(bandeja).getByText(/aprovado e debitado/)).toBeInTheDocument()
    await waitFor(() => expect(within(bandeja).queryByText('Moinho Paulista')).toBeNull())

    await user.click(
      within(bandeja).getByRole('button', { name: /Rejeitar pagamento .* Embalagens Sul/ }),
    )
    await user.type(within(bandeja).getByLabelText(/Motivo/), 'Fornecedor errado')
    await user.click(within(bandeja).getByRole('button', { name: 'Rejeitar pagamento' }))
    expect(await within(bandeja).findByText(/rejeitado. Nada foi debitado/)).toBeInTheDocument()
    const rejeitado = db.pagamentos().find((p) => p.destinatario === 'Embalagens Sul')
    expect(rejeitado).toMatchObject({ status: 'REJEITADO', motivo_rejeicao: 'Fornecedor errado' })

    const historico = screen.getByRole('region', { name: 'Histórico de pagamentos' })
    expect(await within(historico).findByText(/rejeitado por Rafael Lima/)).toBeInTheDocument()
    expect(within(historico).getByText('Motivo: Fornecedor errado')).toBeInTheDocument()
    expect(within(historico).getByText(/aprovado por Rafael Lima/)).toBeInTheDocument()
  })

  it('bandeja: cancelar a rejeição, autor (403 AUTOR) e saldo insuficiente (422)', async () => {
    const user = userEvent.setup()
    pendenteDe('OPERADOR', 3000, 'Moinho Paulista')
    setMembroLogado('FINANCEIRO')
    let resposta: { status: number; body: Record<string, unknown> } = {
      status: 403,
      body: { error: 'SEM_PERMISSAO', permissao: 'aprovar_pagamentos', motivo: 'AUTOR' },
    }
    server.use(
      http.post(`${T}/me/payments/:id/approve`, () =>
        HttpResponse.json(resposta.body, { status: resposta.status }),
      ),
    )
    renderPage()
    const bandeja = await screen.findByRole('region', { name: /Aguardando aprovação/ })
    const rejeitar = await within(bandeja).findByRole('button', { name: /Rejeitar pagamento/ })
    await user.click(rejeitar)
    await user.click(within(bandeja).getByRole('button', { name: 'Manter' }))
    expect(within(bandeja).queryByLabelText(/Motivo/)).not.toBeInTheDocument()

    const aprovar = within(bandeja).getByRole('button', { name: /Aprovar pagamento/ })
    await user.click(aprovar)
    expect(await within(bandeja).findByRole('alert')).toHaveTextContent(/Você fez este pagamento/)

    resposta = { status: 422, body: { error: 'SALDO_INSUFICIENTE', faltam: 500 } }
    await user.click(within(bandeja).getByRole('button', { name: /Aprovar pagamento/ }))
    await waitFor(() =>
      expect(within(bandeja).getByRole('alert')).toHaveTextContent(
        `Saldo insuficiente: faltam ${brl(500)}`,
      ),
    )

    resposta = { status: 403, body: { error: 'SEM_PERMISSAO', permissao: 'aprovar_pagamentos' } }
    await user.click(within(bandeja).getByRole('button', { name: /Aprovar pagamento/ }))
    await waitFor(() =>
      expect(within(bandeja).getByRole('alert')).toHaveTextContent(
        /não permite aprovar pagamentos/,
      ),
    )

    resposta = { status: 422, body: { error: 'PAGAMENTO_NAO_PENDENTE' } }
    await user.click(within(bandeja).getByRole('button', { name: /Aprovar pagamento/ }))
    await waitFor(() =>
      expect(within(bandeja).getByRole('alert')).toHaveTextContent(/já foi decidido/),
    )
  })

  it('conta com pagamento pendente mostra o selo em vez de Pagar', async () => {
    const conta = db.contas('ABERTO').itens.find((c) => c.valor > 2000 && c.valor < 10_000)!
    setMembroLogado('OPERADOR')
    db.pagar({ tipo: 'TED', valor: conta.valor, destinatario: 'X', payable_id: conta.id })
    renderPage()
    const contas = await screen.findByRole('region', { name: 'Contas a pagar' })
    const selo = await within(contas).findByText('Pendente de aprovação')
    const linha = selo.closest('tr')!
    expect(linha).toHaveTextContent(conta.fornecedor)
    expect(within(linha).queryByRole('button', { name: /^Pagar / })).toBeNull()
  })

  it('extrato mostra quem fez o lançamento', async () => {
    server.use(
      http.get(`${T}/me/statement`, () =>
        HttpResponse.json([
          {
            id: 1,
            data: new Date().toISOString(),
            descricao: 'PIX — Moinho Paulista',
            tipo: 'DEBIT',
            valor: 300,
            saldo_apos: 1000,
            created_by_nome: 'Júlia Santos',
          },
        ]),
      ),
    )
    renderPage()
    const extrato = await screen.findByRole('region', { name: 'Extrato' })
    expect(await within(extrato).findByText('feito por Júlia Santos')).toBeInTheDocument()
  })
})
