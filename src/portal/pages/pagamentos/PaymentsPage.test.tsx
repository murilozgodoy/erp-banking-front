import { useAuth0 } from '@auth0/auth0-react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { dayMonth, money } from '../../lib/format'
import * as db from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import { PaymentsPage } from './PaymentsPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const T = 'http://transactions.test'
const brl = (value: number) => money(value).replace(/\s/g, ' ')
const LINHA = '23793381286000782713695000063305975520000370000'

function renderPage(route = '/app/pagamentos') {
  return renderPortal(<PaymentsPage />, { route, path: '/app/pagamentos' })
}

async function openNew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Novo pagamento' }))
  return screen.findByRole('dialog', { name: 'Novo pagamento' })
}

async function fillPix(user: ReturnType<typeof userEvent.setup>, valor: string) {
  await user.type(screen.getByLabelText(/Nome de quem recebe/), 'Moinho Paulista')
  await user.type(screen.getByLabelText(/Chave PIX/), 'financeiro@moinho.com.br')
  await user.type(screen.getByLabelText(/^Valor/), valor)
}

describe('PaymentsPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('mostra saldo, conta, insight, contas a pagar, extrato e histórico', async () => {
    const overview = db.overview()
    renderPage()
    expect(screen.getByRole('heading', { name: 'Pagamentos' })).toBeInTheDocument()
    expect(await screen.findByText(`Ag. 0001 · CC ${overview.conta!.numero}`)).toBeInTheDocument()
    expect(screen.getAllByText(brl(overview.saldo)).length).toBeGreaterThan(0)
    expect(await screen.findByText('Semana apertada')).toBeInTheDocument()
    const contas = screen.getByRole('region', { name: 'Contas a pagar' })
    expect(await within(contas).findAllByRole('button', { name: /^Pagar / })).not.toHaveLength(0)
    const extrato = screen.getByRole('region', { name: 'Extrato' })
    expect(await within(extrato).findAllByText(/Entrada de|Saída de/)).not.toHaveLength(0)
    const historico = screen.getByRole('region', { name: 'Histórico de pagamentos' })
    expect(await within(historico).findAllByText('Efetivado')).not.toHaveLength(0)
  })

  it('filtra as contas por status', async () => {
    const user = userEvent.setup()
    renderPage()
    const atrasadas = db.contas('ATRASADO').itens
    await user.click(await screen.findByRole('radio', { name: `Atrasadas ${atrasadas.length}` }))
    const contas = screen.getByRole('region', { name: 'Contas a pagar' })
    expect(within(contas).getAllByText('Atrasada')).toHaveLength(atrasadas.length)
    await user.click(screen.getByRole('radio', { name: /^Pagas/ }))
    expect(within(contas).queryAllByRole('button', { name: /^Pagar / })).toHaveLength(0)
  })

  it('paga um boleto atrasado: confirmação, comprovante, copiar e imprimir', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const saldo = db.overview().saldo
    const conta = db.contas('ATRASADO').itens.find((c) => c.codigo_barras && c.valor < saldo)!
    renderPage()
    await user.click(await screen.findByRole('radio', { name: /^Atrasadas/ }))
    const contas = screen.getByRole('region', { name: 'Contas a pagar' })
    const row = within(contas).getByRole('button', {
      name: new RegExp(`^Pagar ${conta.fornecedor}, vencimento ${dayMonth(conta.vencimento)}$`),
    })
    await user.click(row)
    const dialog = await screen.findByRole('dialog', { name: `Pagar ${conta.fornecedor}` })
    expect(within(dialog).getByRole('radio', { name: 'Boleto' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(dialog).getByLabelText(/Linha digitável/)).toHaveAttribute('readonly')
    expect(within(dialog).getByLabelText(/^Valor/)).toHaveAttribute('readonly')

    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    expect(await within(dialog).findByText('Você vai pagar agora')).toBeInTheDocument()
    expect(within(dialog).getByText(brl(saldo - conta.valor))).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await within(dialog).findByText('Pagamento efetivado')).toBeInTheDocument()
    const receipt = within(dialog).getByRole('region', { name: 'Comprovante de pagamento' })
    const auth = db.pagamentos()[0].autenticacao
    expect(within(receipt).getByText(auth)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Copiar autenticação' }))
    expect(await within(dialog).findByText('Autenticação copiada.')).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe(auth)
    await user.click(within(dialog).getByRole('button', { name: 'Imprimir comprovante' }))
    expect(print).toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const historico = screen.getByRole('region', { name: 'Histórico de pagamentos' })
    expect(await within(historico).findByText(conta.fornecedor)).toBeInTheDocument()
  })

  it('saldo insuficiente: mostra quanto falta e o capital de giro', async () => {
    const user = userEvent.setup()
    const saldo = db.overview().saldo
    renderPage()
    const dialog = await openNew(user)
    await fillPix(user, String(Math.ceil(saldo) + 500).replace('.', ','))
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    expect(await within(dialog).findByText(/O saldo de hoje não cobre/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await within(dialog).findByText('Saldo insuficiente')).toBeInTheDocument()
    const faltam = Math.round((Math.ceil(saldo) + 500 - saldo) * 100) / 100
    expect(within(dialog).getByText(brl(faltam))).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Pagar com capital de giro/ })).toHaveAttribute(
      'href',
      `/app/credito?produto=CAPITAL_DE_GIRO&valor=${Math.ceil(faltam)}`,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Agendar para outra data' }))
    expect(await within(dialog).findByLabelText(/Data do pagamento/)).toBeInTheDocument()
  })

  it('agenda um boleto avulso para uma data futura', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openNew(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Boleto' }))
    await user.type(await within(dialog).findByLabelText(/Linha digitável/), LINHA)
    expect(within(dialog).getByLabelText(/Linha digitável/)).toHaveValue(
      '23793.38128 60007.827136 95000.063305 9 75520000370000',
    )
    await user.type(within(dialog).getByLabelText(/Beneficiário/), 'Moinho Paulista')
    await user.type(within(dialog).getByLabelText(/^Valor/), '1250,90')
    await user.click(within(dialog).getByRole('radio', { name: 'Agendar' }))
    fireEvent.change(within(dialog).getByLabelText(/Data do pagamento/), {
      target: { value: '2099-01-15' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    expect(
      await within(dialog).findByText('Agendar para 15 de janeiro de 2099'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar agendamento' }))
    expect(await within(dialog).findByText('Pagamento agendado')).toBeInTheDocument()
    expect(db.pagamentos()[0]).toMatchObject({
      tipo: 'BOLETO',
      status: 'AGENDADO',
      agendado_para: '2099-01-15',
      codigo_barras: LINHA,
      valor: 1250.9,
    })
  })

  it('TED: dados bancários vão no destinatário', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openNew(user)
    await user.click(within(dialog).getByRole('radio', { name: 'TED' }))
    await user.type(await within(dialog).findByLabelText(/Favorecido/), 'Ana Lima')
    await user.type(within(dialog).getByLabelText(/^Banco/), '341')
    await user.type(within(dialog).getByLabelText(/^Agência/), '1234')
    await user.type(within(dialog).getByLabelText(/Conta com dígito/), '12345-6')
    await user.type(within(dialog).getByLabelText(/^Valor/), '10')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar pagamento' }))
    expect(await within(dialog).findByText('Pagamento efetivado')).toBeInTheDocument()
    expect(db.pagamentos()[0].destinatario).toBe('Ana Lima · banco 341 · ag. 1234 · cc 12345-6')
  })

  it('valida os campos antes de revisar', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openNew(user)
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    expect(await within(dialog).findByText('Informe o nome de quem recebe.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Informe a chave PIX/)).toBeInTheDocument()
    expect(within(dialog).getByText('Informe um valor maior que zero.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Boleto' }))
    await user.type(await within(dialog).findByLabelText(/Linha digitável/), '1234')
    await user.click(within(dialog).getByRole('radio', { name: 'Agendar' }))
    fireEvent.change(within(dialog).getByLabelText(/Data do pagamento/), {
      target: { value: '2000-01-01' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    expect(
      await within(dialog).findByText('A linha digitável tem 47 dígitos; você digitou 4.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Escolha hoje ou uma data futura.')).toBeInTheDocument()
  })

  it('erro de validação da API volta para o campo', async () => {
    server.use(
      http.post(`${T}/me/payments`, () =>
        HttpResponse.json(
          {
            error: 'validation_failed',
            message: 'Dados inválidos.',
            campos: { destinatario: 'Informe o destinatário.' },
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    const dialog = await openNew(user)
    await fillPix(user, '10')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar pagamento' }))
    expect(await within(dialog).findByText('Informe o destinatário.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Revise os campos destacados/)).toBeInTheDocument()
  })

  it.each([
    ['CONTA_JA_AGENDADA', /já tem um pagamento agendado/],
    ['CONTA_JA_PAGA', /já foi paga/],
    ['VALOR_DIVERGENTE', /O valor não confere com o da conta/],
    ['CONTA_A_PAGAR_NAO_ENCONTRADA', /Não encontramos esta conta/],
  ])('conta a pagar com %s: explica e não deixa repetir', async (code, text) => {
    server.use(
      http.post(`${T}/me/payments`, () =>
        HttpResponse.json(
          { error: code, message: 'x' },
          { status: code.includes('NAO') ? 404 : 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    const conta = db.contas('ABERTO').itens[0]
    renderPage(`/app/pagamentos?conta=${conta.id}`)
    const dialog = await screen.findByRole('dialog', { name: `Pagar ${conta.fornecedor}` })
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    await user.click(await within(dialog).findByRole('button', { name: /Confirmar/ }))
    expect(await within(dialog).findByText(text)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Voltar às contas' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('erro inesperado no pagamento mostra a mensagem e permite tentar de novo', async () => {
    server.use(http.post(`${T}/me/payments`, () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    renderPage()
    const dialog = await openNew(user)
    await fillPix(user, '10')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar pagamento' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar pagamento' }))
    expect(await within(dialog).findByText(/Erro inesperado/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled()
    await user.click(within(dialog).getByRole('button', { name: 'Voltar e editar' }))
    expect(await within(dialog).findByLabelText(/Chave PIX/)).toHaveValue(
      'financeiro@moinho.com.br',
    )
  })

  it('oferece capital de giro quando as contas da semana passam do saldo', async () => {
    const saldo = db.overview().saldo
    server.use(
      http.get(`${T}/me/payables`, () =>
        HttpResponse.json({ ...db.contas(), proximos_7d: saldo + 4200.5 }),
      ),
    )
    renderPage()
    const link = await screen.findByRole('link', { name: /Pagar com capital de giro/ })
    expect(link).toHaveAttribute('href', '/app/credito?produto=CAPITAL_DE_GIRO&valor=4201')
    expect(screen.getByText(`Faltam ${brl(4200.5)} no saldo`)).toBeInTheDocument()
  })

  it('troca o período do extrato', async () => {
    const user = userEvent.setup()
    const pedidos: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/me/statement')) pedidos.push(request.url)
    })
    renderPage()
    const extrato = screen.getByRole('region', { name: 'Extrato' })
    await within(extrato).findAllByText(/Entrada de|Saída de/)
    await user.click(within(extrato).getByRole('radio', { name: '90 dias' }))
    await waitFor(() => expect(pedidos).toHaveLength(2))
    const [from, to] = ['from', 'to'].map((k) => new URL(pedidos[1]).searchParams.get(k)!)
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBe(90)
    const mais = await within(extrato).findByRole('button', { name: /Mostrar mais/ })
    const linhas = within(extrato).getAllByRole('row').length
    await user.click(mais)
    expect(within(extrato).getAllByRole('row').length).toBeGreaterThan(linhas)
    server.events.removeAllListeners()
  })

  it('estados vazios ensinam o que fazer', async () => {
    server.use(
      http.get(`${T}/me/payables`, () =>
        HttpResponse.json({ itens: [], total_aberto: 0, total_atrasado: 0, proximos_7d: 0 }),
      ),
      http.get(`${T}/me/payments`, () => HttpResponse.json([])),
      http.get(`${T}/me/statement`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Nenhuma conta em aberto')).toBeInTheDocument()
    expect(await screen.findByText('Nenhum pagamento ainda')).toBeInTheDocument()
    expect(await screen.findByText('Sem lançamentos no período')).toBeInTheDocument()
    expect(screen.getByText('Nada atrasado')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Agendadas/ }))
    expect(screen.getByText('Nenhum pagamento agendado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fazer o primeiro pagamento' }))
    expect(await screen.findByRole('dialog', { name: 'Novo pagamento' })).toBeInTheDocument()
  })

  it('erro ao carregar: mostra o problema e tenta de novo', async () => {
    let falhar = true
    server.use(
      http.get(`${T}/me/payables`, () =>
        falhar ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(db.contas()),
      ),
      http.get(`${T}/me/payments`, () => new HttpResponse(null, { status: 503 })),
      http.get(`${T}/me/statement`, () => new HttpResponse(null, { status: 503 })),
      http.get(`${T}/me/overview`, () => new HttpResponse(null, { status: 503 })),
    )
    const user = userEvent.setup()
    renderPage()
    expect(
      await screen.findByText('Não conseguimos carregar as contas a pagar'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Não conseguimos carregar o saldo')).toBeInTheDocument()
    expect(await screen.findByText('Não conseguimos carregar o extrato')).toBeInTheDocument()
    expect(await screen.findByText('Não conseguimos carregar o histórico')).toBeInTheDocument()
    falhar = false
    const contas = screen.getByRole('region', { name: 'Contas a pagar' })
    await user.click(within(contas).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(contas).findAllByRole('button', { name: /^Pagar / })).not.toHaveLength(0)
  })

  it('409 ONBOARDING_PENDENTE: explica que a conta está sendo aberta', async () => {
    db.setMockStatus('EM_ANALISE')
    renderPage()
    expect(await screen.findByText('Sua conta PJ ainda está sendo aberta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acompanhar a análise' })).toHaveAttribute(
      'href',
      '/app/status',
    )
  })

  it('link das pendências abre o pagamento da conta', async () => {
    const conta = db.contas('ATRASADO').itens[0]
    renderPage(`/app/pagamentos?conta=${conta.id}`)
    const dialog = await screen.findByRole('dialog', { name: `Pagar ${conta.fornecedor}` })
    expect(within(dialog).getByLabelText(/^Valor/)).toHaveValue(
      conta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    )
  })
})
