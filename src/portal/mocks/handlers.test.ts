import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BusinessAnalysis,
  CreditOffer,
  InventoryReport,
  Me,
  OnboardingDraft,
  OnboardingTemplate,
  Overview,
  PayablesReport,
  Payment,
  PaymentResponse,
  Pendencia,
  PortalCreditRequest,
  ReceivablesReport,
  ReviewDecisionResult,
  ReviewItem,
  SalesReport,
  Simulation,
  StatementEntry,
} from '../types'
import { EMPRESA_AURORA, RESPOSTAS_AURORA, resetMockDb, setMockStatus } from './db'
import { mockServer } from './server'

const O = 'http://onboarding.test'
const S = 'http://score.test'
const T = 'http://transactions.test'

/** Data `yyyy-MM-dd` relativa a hoje (fuso local = São Paulo nos testes). */
function diaRelativo(dias: number): string {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`
}

async function chamar<T>(url: string, method = 'GET', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: (await response.json()) as T }
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => resetMockDb())
afterEach(() => {
  mockServer.resetHandlers()
  vi.useRealTimers()
})
afterAll(() => mockServer.close())

describe('onboarding', () => {
  it('lista os 9 templates com 8 a 14 campos', async () => {
    const { data } = await chamar<OnboardingTemplate[]>(`${O}/onboarding/templates`)
    expect(data.map((t) => t.segmento)).toHaveLength(9)
    for (const template of data) {
      const campos = template.secoes.flatMap((s) => s.campos)
      expect(campos.length).toBeGreaterThanOrEqual(8)
      expect(campos.length).toBeLessThanOrEqual(14)
      expect(campos.some((c) => c.id === 'faturamento_mensal' && c.obrigatorio)).toBe(true)
    }
  })

  it('PUT substitui o estado e devolve e-mail/telefone nulos quando ausentes', async () => {
    const semContato: Record<string, unknown> = { ...EMPRESA_AURORA }
    delete semContato.email
    delete semContato.telefone
    const salvo = await chamar<OnboardingDraft>(`${O}/me/onboarding`, 'PUT', {
      empresa: semContato,
      segmento: 'varejo',
      respostas: { faturamento_mensal: 50_000 },
      observacoes: 'x',
      enviar: false,
    })
    expect(salvo.data.empresa).toMatchObject({ email: null, telefone: null })
    const substituido = await chamar<OnboardingDraft>(`${O}/me/onboarding`, 'PUT', {
      empresa: EMPRESA_AURORA,
      segmento: null,
      respostas: {},
      observacoes: '',
      enviar: false,
    })
    expect(substituido.data).toMatchObject({ segmento: null, respostas: {}, observacoes: '' })
    expect((await chamar<OnboardingDraft>(`${O}/me/onboarding`)).data).toEqual(substituido.data)
  })

  it('começa sem customer', async () => {
    const { data } = await chamar<Me>(`${O}/me`)
    expect(data).toEqual({ customer_id: null, onboarding_status: 'NAO_INICIADO', empresa: null })
    const draft = await chamar<OnboardingDraft>(`${O}/me/onboarding`)
    expect(draft.data.updated_at).toBeNull()
  })

  it('valida, envia e aprova ~8 s depois', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 10, 0, 0))

    const rascunho = await chamar<OnboardingDraft>(`${O}/me/onboarding`, 'PUT', {
      empresa: EMPRESA_AURORA,
      segmento: 'alimentacao',
      respostas: { faturamento_mensal: 182_000 },
      observacoes: '',
      enviar: false,
    })
    expect(rascunho.data.onboarding_status).toBe('RASCUNHO')

    const invalido = await chamar<{ detail: string; campos: { campo: string; erro: string }[] }>(
      `${O}/me/onboarding`,
      'PUT',
      {
        empresa: { ...EMPRESA_AURORA, cnpj: '11111111111111' },
        segmento: 'alimentacao',
        respostas: {
          faturamento_mensal: 182_000,
          possui_estoque: true,
          prazo_medio_recebimento_dias: 10.5,
          margem_bruta_pct: 140,
          sazonalidade: 'Fim de ano',
        },
        observacoes: '',
        enviar: true,
      },
    )
    expect(invalido.status).toBe(422)
    const campos = invalido.data.campos.map((e) => e.campo)
    expect(campos).toEqual(
      expect.arrayContaining([
        'empresa.cnpj',
        'ticket_medio',
        'pct_cartao_credito',
        'dividas_total',
        'valor_estoque',
        'prazo_medio_recebimento_dias',
        'margem_bruta_pct',
        'sazonalidade',
      ]),
    )
    expect(invalido.data.detail).toBeTruthy()
    expect(invalido.data.campos.every((e) => e.erro.length > 0)).toBe(true)

    const enviado = await chamar<OnboardingDraft>(`${O}/me/onboarding`, 'PUT', {
      empresa: EMPRESA_AURORA,
      segmento: 'alimentacao',
      respostas: RESPOSTAS_AURORA,
      observacoes: 'Padaria',
      enviar: true,
    })
    expect(enviado.data.onboarding_status).toBe('EM_ANALISE')
    const emAnalise = await chamar<BusinessAnalysis>(`${S}/me/analysis`)
    expect(emAnalise.data.status).toBe('EM_ANALISE')
    expect((await chamar(`${T}/me/overview`)).status).toBe(409)
    const reenvio = await chamar(`${O}/me/onboarding`, 'PUT', { enviar: false })
    expect(reenvio.status).toBe(409)

    vi.setSystemTime(new Date(2026, 10, 3, 10, 0, 9))
    expect((await chamar<Me>(`${O}/me`)).data).toMatchObject({
      customer_id: 1042,
      onboarding_status: 'APROVADO',
    })
    expect((await chamar(`${T}/me/overview`)).status).toBe(200)
  })

  it('segmento outro vai para a análise manual e o analista decide', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 10, 0, 0))
    await chamar(`${O}/me/onboarding`, 'PUT', {
      empresa: EMPRESA_AURORA,
      segmento: 'outro',
      respostas: { ...RESPOSTAS_AURORA, sazonalidade: 'Alta' },
      observacoes: 'Negócio diferente',
      enviar: true,
    })
    vi.setSystemTime(new Date(2026, 10, 3, 10, 0, 30))
    const fila = await chamar<{ customer_id: number }[]>(
      `${O}/onboarding/reviews?status=ANALISE_MANUAL`,
    )
    // Fila em ordem de envio: o cliente acabou de enviar, então é o último.
    expect(fila.data.at(-1)?.customer_id).toBe(1042)
    const decisao = await chamar<ReviewDecisionResult>(
      `${O}/onboarding/reviews/1042/decision`,
      'POST',
      { decisao: 'APROVADO', comentario: 'ok' },
    )
    expect(decisao.status).toBe(200)
    expect(decisao.data).toMatchObject({
      customer_id: 1042,
      onboarding_status: 'APROVADO',
      decisao: 'APROVADO',
      comentario: 'ok',
    })
    expect(decisao.data.reviewer).toBeTruthy()
    expect(decisao.data.reviewed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect((await chamar<Me>(`${O}/me`)).data.onboarding_status).toBe('APROVADO')
  })
})

describe('fila de análise (backoffice)', () => {
  it('traz o resumo da análise e remove o item decidido', async () => {
    const fila = await chamar<{ customer_id: number; analise: Record<string, unknown> }[]>(
      `${O}/onboarding/reviews`,
    )
    expect(fila.data).toHaveLength(4)
    const envios = fila.data.map((i) => (i as unknown as ReviewItem).submitted_at)
    expect(envios).toEqual([...envios].sort())
    expect(Object.keys(fila.data[0].analise).sort()).toEqual([
      'faixa_risco',
      'gerado_por',
      'score',
      'status',
    ])
    const id = fila.data[1].customer_id
    const completa = await chamar<BusinessAnalysis>(`${S}/scores/analyses/${id}`)
    expect(completa.data.kpis.length).toBeGreaterThan(0)

    const invalida = await chamar(`${O}/onboarding/reviews/${id}/decision`, 'POST', {
      decisao: 'TALVEZ',
    })
    expect(invalida.status).toBe(422)
    const decidida = await chamar(`${O}/onboarding/reviews/${id}/decision`, 'POST', {
      decisao: 'REPROVADO',
      comentario: 'Endividamento alto',
    })
    expect(decidida.status).toBe(200)
    const depois = await chamar<{ customer_id: number }[]>(
      `${O}/onboarding/reviews?status=ANALISE_MANUAL`,
    )
    expect(depois.data.map((i) => i.customer_id)).not.toContain(id)
    const reprovados = await chamar<unknown[]>(`${O}/onboarding/reviews?status=REPROVADO`)
    expect(reprovados.data).toHaveLength(1)
    const denovo = await chamar(`${O}/onboarding/reviews/${id}/decision`, 'POST', {
      decisao: 'APROVADO',
    })
    expect(denovo.status).toBe(409)
    expect(
      (await chamar(`${O}/onboarding/reviews/77/decision`, 'POST', { decisao: 'APROVADO' })).status,
    ).toBe(404)
    expect(
      (await chamar(`${O}/onboarding/reviews/1042/decision`, 'POST', { decisao: 'APROVADO' }))
        .status,
    ).toBe(404)
    expect((await chamar(`${S}/scores/analyses/999`)).status).toBe(404)
  })
})

describe('análise do cliente', () => {
  it('404 sem customer', async () => {
    const { status, data } = await chamar(`${S}/me/analysis`)
    expect(status).toBe(404)
    expect(data).toEqual({ error: 'ONBOARDING_NAO_INICIADO' })
  })

  it('aprovado traz os 9 KPIs, insights de todas as áreas e oportunidades', async () => {
    setMockStatus('APROVADO')
    const { data } = await chamar<BusinessAnalysis>(`${S}/me/analysis`)
    expect(data).toMatchObject({ score: 742, faixa_risco: 'MEDIO', status: 'APROVADO' })
    expect(data.kpis).toHaveLength(9)
    const areas = new Set(data.insights.map((i) => i.area))
    for (const area of [
      'geral',
      'vendas',
      'recebiveis',
      'pagamentos',
      'estoque',
      'pendencias',
      'credito',
    ]) {
      expect(areas).toContain(area)
    }
    expect(data.insights[0].texto).toMatch(/Seu caixa fica negativo em \d+ dias/)
    expect(data.oportunidades.length).toBeGreaterThanOrEqual(4)
    const viaStaff = await chamar<BusinessAnalysis>(`${S}/scores/analyses/1042`)
    expect(viaStaff.data.score).toBe(742)
  })

  it('reprovado devolve status REPROVADO', async () => {
    setMockStatus('REPROVADO')
    const { data } = await chamar<BusinessAnalysis>(`${S}/me/analysis`)
    expect(data.status).toBe('REPROVADO')
  })

  it('rascunho ainda não tem análise', async () => {
    setMockStatus('RASCUNHO')
    const { status, data } = await chamar(`${S}/me/analysis`)
    expect(status).toBe(404)
    expect(data).toEqual({ error: 'ANALISE_NAO_ENCONTRADA' })
  })
})

describe('transactions /me', () => {
  it('409 antes da aprovação', async () => {
    const { status, data } = await chamar(`${T}/me/overview`)
    expect(status).toBe(409)
    expect(data).toEqual({ error: 'ONBOARDING_PENDENTE', status: 'NAO_INICIADO' })
  })

  describe('aprovado', () => {
    beforeEach(() => setMockStatus('APROVADO'))

    it('overview com vale de caixa negativo no fluxo de 60 dias', async () => {
      const { data } = await chamar<Overview>(`${T}/me/overview`)
      expect(data.fluxo_caixa).toHaveLength(60)
      expect(data.saldo).toBeGreaterThan(0)
      expect(data.conta).toMatchObject({ agencia: '0001', numero: '048213-7' })
      expect(data.receita_30d).toBeCloseTo(182_000, -3)
      const negativos = data.fluxo_caixa
        .map((dia, i) => (dia.saldo_projetado < 0 ? i : -1))
        .filter((i) => i >= 0)
      expect(negativos.length).toBeGreaterThanOrEqual(3)
      expect(negativos[0]).toBeGreaterThanOrEqual(12)
      expect(negativos[0]).toBeLessThanOrEqual(24)
      expect(data.fluxo_caixa[59].saldo_projetado).toBeGreaterThan(0)
      expect(data.pendencias_count).toBeGreaterThan(0)
    })

    it('é determinístico', async () => {
      const a = await chamar<Overview>(`${T}/me/overview`)
      resetMockDb('APROVADO')
      const b = await chamar<Overview>(`${T}/me/overview`)
      expect(b.data).toEqual(a.data)
    })

    it('vendas por dia, semana e mês', async () => {
      const dia = await chamar<SalesReport>(`${T}/me/sales`)
      expect(dia.data.serie).toHaveLength(30)
      expect(dia.data.por_canal.map((c) => c.canal)).toEqual(
        expect.arrayContaining(['Balcão', 'iFood', 'Encomendas', 'WhatsApp']),
      )
      expect(dia.data.top_produtos.length).toBe(10)
      const semana = await chamar<SalesReport>(`${T}/me/sales?group_by=week`)
      expect(semana.data.serie.length).toBeLessThanOrEqual(6)
      const mes = await chamar<SalesReport>(
        `${T}/me/sales?group_by=month&from=${diaRelativo(-125)}&to=${diaRelativo(0)}`,
      )
      expect(mes.data.total).toBeGreaterThan(dia.data.total * 3)
    })

    it('recebíveis com filtros', async () => {
      const todos = await chamar<ReceivablesReport>(`${T}/me/receivables`)
      expect(todos.data.itens.some((r) => r.status === 'RECEBIDO')).toBe(true)
      const previstos = await chamar<ReceivablesReport>(`${T}/me/receivables?status=PREVISTO`)
      expect(previstos.data.itens.every((r) => r.status === 'PREVISTO')).toBe(true)
      expect(previstos.data.total_previsto).toBeGreaterThan(0)
      expect(previstos.data.por_semana.length).toBeGreaterThan(5)
      const adquirentes = new Set(previstos.data.itens.map((r) => r.adquirente))
      expect(adquirentes).toContain('Cielo')
      const janela = await chamar<ReceivablesReport>(
        `${T}/me/receivables?from=2000-01-01&to=2000-01-02`,
      )
      expect(janela.data.itens).toHaveLength(0)
    })

    it('contas a pagar com atrasadas e filtro de status', async () => {
      const { data } = await chamar<PayablesReport>(`${T}/me/payables?status=ATRASADO`)
      expect(data.itens).toHaveLength(3)
      expect(data.total_atrasado).toBeGreaterThan(0)
      const abertas = await chamar<PayablesReport>(`${T}/me/payables?status=ABERTO,AGENDADO`)
      expect(abertas.data.itens.length).toBeGreaterThan(20)
    })

    it('pagamento reduz o saldo e entra no extrato', async () => {
      const antes = await chamar<Overview>(`${T}/me/overview`)
      const contas = await chamar<PayablesReport>(`${T}/me/payables?status=ATRASADO`)
      const conta = contas.data.itens.find((c) => c.valor < antes.data.saldo)!
      const pago = await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', {
        tipo: 'BOLETO',
        valor: conta.valor,
        destinatario: conta.fornecedor,
        descricao: 'Boleto atrasado',
        payable_id: conta.id,
      })
      expect(pago.status).toBe(201)
      expect(pago.data.status).toBe('EFETIVADO')
      expect(pago.data.autenticacao).toMatch(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/)
      expect(pago.data.saldo_apos).toBeCloseTo(antes.data.saldo - conta.valor, 2)
      expect(pago.data.comprovante).toMatchObject({
        conta_origem: { id: 7, agencia: '0001', numero: '048213-7' },
        autenticacao: pago.data.autenticacao,
        codigo_barras: conta.codigo_barras,
      })
      expect(pago.data.comprovante.data_hora).toMatch(/Z$/)

      const depois = await chamar<PayablesReport>(`${T}/me/payables?status=PAGO`)
      expect(depois.data.itens.some((c) => c.id === conta.id)).toBe(true)
      const extrato = await chamar<StatementEntry[]>(`${T}/me/statement`)
      expect(extrato.data[0]).toMatchObject({ tipo: 'DEBIT', saldo_apos: pago.data.saldo_apos })
      const historico = await chamar<Payment[]>(`${T}/me/payments`)
      expect(historico.data[0].id).toBe(pago.data.id)

      const repetido = await chamar<{ error: string }>(`${T}/me/payments`, 'POST', {
        tipo: 'BOLETO',
        valor: 1,
        destinatario: 'x',
        payable_id: conta.id,
      })
      expect(repetido.status).toBe(422)
      expect(repetido.data.error).toBe('CONTA_JA_PAGA')
    })

    it('422 com saldo insuficiente, mas agenda pagamento futuro', async () => {
      const { data } = await chamar<Overview>(`${T}/me/overview`)
      const falta = await chamar<{ error: string; faltam: number }>(`${T}/me/payments`, 'POST', {
        tipo: 'PIX',
        valor: data.saldo + 100,
        destinatario: 'Moinho Paulista',
        descricao: 'Farinha',
      })
      expect(falta.status).toBe(422)
      expect(falta.data).toMatchObject({ error: 'SALDO_INSUFICIENTE', faltam: 100 })

      const abertas = await chamar<PayablesReport>(`${T}/me/payables?status=ABERTO`)
      const conta = abertas.data.itens.at(-1)!
      const agendado = await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', {
        tipo: 'PIX',
        valor: data.saldo + 100,
        destinatario: 'Moinho Paulista',
        descricao: '',
        agendado_para: conta.vencimento,
      })
      expect(agendado.data.status).toBe('AGENDADO')
      expect(agendado.data.saldo_apos).toBe(data.saldo)
    })

    it('conta a pagar: valor igual ao da conta e um agendamento só', async () => {
      const abertas = await chamar<PayablesReport>(`${T}/me/payables?status=ABERTO`)
      const conta = abertas.data.itens.at(-1)!
      const pedido = {
        tipo: 'BOLETO',
        valor: conta.valor,
        destinatario: conta.fornecedor,
        payable_id: conta.id,
        agendado_para: conta.vencimento,
      }
      const divergente = await chamar<{ error: string }>(`${T}/me/payments`, 'POST', {
        ...pedido,
        valor: conta.valor + 1,
      })
      expect(divergente.status).toBe(422)
      expect(divergente.data.error).toBe('VALOR_DIVERGENTE')

      const passado = await chamar<{ error: string; campos: object }>(
        `${T}/me/payments`,
        'POST',
        { ...pedido, agendado_para: '2000-01-01' },
      )
      expect(passado.status).toBe(400)
      expect(Object.keys(passado.data.campos)).toEqual(['agendado_para'])

      const agendado = await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', pedido)
      expect(agendado.data.status).toBe('AGENDADO')
      const repetido = await chamar<{ error: string }>(`${T}/me/payments`, 'POST', pedido)
      expect(repetido.status).toBe(422)
      expect(repetido.data.error).toBe('CONTA_JA_AGENDADA')
    })

    it('400 validation_failed e 404 para pagamento inválido', async () => {
      const invalido = await chamar<{ error: string; message: string; campos: object }>(
        `${T}/me/payments`,
        'POST',
        { tipo: 'DOC', valor: 0, destinatario: ' ', agendado_para: 'amanhã' },
      )
      expect(invalido.status).toBe(400)
      expect(invalido.data.error).toBe('validation_failed')
      expect(Object.keys(invalido.data.campos).sort()).toEqual([
        'agendado_para',
        'destinatario',
        'tipo',
        'valor',
      ])
      const semConta = await chamar<{ error: string }>(`${T}/me/payments`, 'POST', {
        tipo: 'PIX',
        valor: 10,
        destinatario: 'x',
        payable_id: 1,
      })
      expect(semConta.status).toBe(404)
      expect(semConta.data.error).toBe('CONTA_A_PAGAR_NAO_ENCONTRADA')
    })

    it('estoque com itens abaixo do mínimo e parados', async () => {
      const { data } = await chamar<InventoryReport>(`${T}/me/inventory`)
      expect(data.itens.length).toBeGreaterThanOrEqual(15)
      expect(data.abaixo_minimo).toBeGreaterThan(0)
      expect(data.valor_parado).toBeGreaterThan(0)
      expect(data.cobertura_media_dias).toBeGreaterThan(0)
    })

    it('pendências com ação e crédito', async () => {
      const { data } = await chamar<Pendencia[]>(`${T}/me/pendencias`)
      const tipos = new Set(data.map((p) => p.tipo))
      for (const tipo of [
        'SALDO_INSUFICIENTE',
        'CONTA_ATRASADA',
        'VENCE_HOJE',
        'ESTOQUE_BAIXO',
        'ESTOQUE_PARADO',
        'PROPOSTA_CREDITO',
      ]) {
        expect(tipos).toContain(tipo)
      }
      expect(data.find((p) => p.tipo === 'SALDO_INSUFICIENTE')?.acao.credito?.produto).toBe(
        'ANTECIPACAO_RECEBIVEIS',
      )
    })

    it('ofertas, simulação e contratação de crédito', async () => {
      const ofertas = await chamar<CreditOffer[]>(`${T}/me/credit/offers`)
      expect(ofertas.data.map((o) => o.produto)).toEqual([
        'ANTECIPACAO_RECEBIVEIS',
        'CAPITAL_DE_GIRO',
        'ALAVANCAGEM',
        'FINANCIAMENTO_ESTOQUE',
      ])
      const capital = ofertas.data.find((o) => o.produto === 'CAPITAL_DE_GIRO')!

      const sim = await chamar<Simulation>(`${T}/me/credit/simulations`, 'POST', {
        produto: 'CAPITAL_DE_GIRO',
        valor: 30_000,
        prazo_meses: 12,
      })
      expect(sim.status).toBe(201)
      expect(sim.data.aprovacao).toBe('PRE_APROVADO')
      expect(sim.data.limite_disponivel).toBe(capital.limite)

      const antes = await chamar<Overview>(`${T}/me/overview`)
      const contrato = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
        simulation_id: sim.data.id,
      })
      expect(contrato.status).toBe(201)
      expect(contrato.data).toMatchObject({
        status: 'APROVADO',
        customerId: 1042,
        valorSolicitado: 30_000,
        valorAprovado: 30_000,
        prazoMeses: 12,
        taxaJuros: 0.0249,
        scoreSnapshot: 742,
      })
      const reuso = await chamar<{ error: string }>(`${T}/me/credit/requests`, 'POST', {
        simulation_id: sim.data.id,
      })
      expect(reuso.status).toBe(422)
      expect(reuso.data.error).toBe('SIMULACAO_JA_UTILIZADA')
      const depois = await chamar<Overview>(`${T}/me/overview`)
      expect(depois.data.saldo).toBeCloseTo(antes.data.saldo + sim.data.valor_liquido, 2)
      const parcelas = await chamar<PayablesReport>(`${T}/me/payables?status=ABERTO`)
      expect(parcelas.data.itens.some((c) => c.fornecedor.startsWith('ErpIa'))).toBe(true)

      const analise = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
        produto: 'CAPITAL_DE_GIRO',
        valor: capital.limite * 1.2,
        prazo_meses: 24,
      })
      expect(analise.data.status).toBe('REVISAO')
      const negado = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
        produto: 'ALAVANCAGEM',
        valor: 99_000_000,
        prazo_meses: 36,
      })
      expect(negado.data).toMatchObject({ status: 'NEGADO', valorAprovado: null, taxaJuros: null })

      const lista = await chamar<PortalCreditRequest[]>(`${T}/me/credit/requests`)
      // 2 iniciais (uma aprovada, uma em revisão) + 3 contratadas no teste.
      expect(lista.data).toHaveLength(5)
      expect(lista.data[0].id).toBe(negado.data.id)
    })

    it('antecipação cobre o vale de caixa', async () => {
      const antes = await chamar<Overview>(`${T}/me/overview`)
      const minimoAntes = Math.min(...antes.data.fluxo_caixa.map((d) => d.saldo_projetado))
      const pendencias = await chamar<Pendencia[]>(`${T}/me/pendencias`)
      const sugerido = pendencias.data.find((p) => p.id === 'saldo-insuficiente')!.acao.credito!
        .valor
      const contrato = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
        produto: 'ANTECIPACAO_RECEBIVEIS',
        valor: sugerido,
        prazo_meses: 1,
      })
      expect(contrato.data.status).toBe('APROVADO')
      const depois = await chamar<Overview>(`${T}/me/overview`)
      const minimoDepois = Math.min(...depois.data.fluxo_caixa.map((d) => d.saldo_projetado))
      expect(minimoDepois).toBeGreaterThan(minimoAntes)
      const antecipados = await chamar<ReceivablesReport>(`${T}/me/receivables?status=ANTECIPADO`)
      expect(antecipados.data.itens.length).toBeGreaterThan(0)
    })

    it('simulação com recebíveis selecionados e erros de entrada', async () => {
      const { data } = await chamar<ReceivablesReport>(`${T}/me/receivables?status=PREVISTO`)
      const ids = data.itens.slice(0, 3).map((r) => r.id)
      const bruto = data.itens.slice(0, 3).reduce((t, r) => t + r.valor_bruto, 0)
      const sim = await chamar<Simulation>(`${T}/me/credit/simulations`, 'POST', {
        produto: 'ANTECIPACAO_RECEBIVEIS',
        valor: 1_000,
        prazo_meses: 1,
        receivable_ids: ids,
      })
      expect(sim.data.limite_disponivel).toBeCloseTo(bruto * 0.8, 1)
      for (const body of [
        { produto: 'X', valor: 1, prazo_meses: 1 },
        { produto: 'ANTECIPACAO_RECEBIVEIS', valor: -1, prazo_meses: 1 },
        { produto: 'ANTECIPACAO_RECEBIVEIS', valor: 1, prazo_meses: 0 },
        { produto: 'ANTECIPACAO_RECEBIVEIS', valor: 1, prazo_meses: 7 },
      ]) {
        const resposta = await chamar<{ error: string }>(`${T}/me/credit/simulations`, 'POST', body)
        expect(resposta.status).toBe(400)
        expect(resposta.data.error).toBe('validation_failed')
      }
      const inexistente = await chamar<{ error: string }>(`${T}/me/credit/simulations`, 'POST', {
        produto: 'ANTECIPACAO_RECEBIVEIS',
        valor: 1_000,
        prazo_meses: 1,
        receivable_ids: [1],
      })
      expect(inexistente.status).toBe(404)
      expect(inexistente.data.error).toBe('RECEBIVEL_NAO_ENCONTRADO')
      const recebido = await chamar<ReceivablesReport>(`${T}/me/receivables?status=RECEBIDO`)
      const indisponivel = await chamar<{ error: string }>(`${T}/me/credit/simulations`, 'POST', {
        produto: 'ANTECIPACAO_RECEBIVEIS',
        valor: 1_000,
        prazo_meses: 1,
        receivable_ids: [recebido.data.itens[0].id],
      })
      expect(indisponivel.status).toBe(422)
      expect(indisponivel.data.error).toBe('RECEBIVEL_INDISPONIVEL')
      const semSimulacao = await chamar<{ error: string }>(`${T}/me/credit/requests`, 'POST', {
        simulation_id: 'nope',
      })
      expect(semSimulacao.status).toBe(404)
      expect(semSimulacao.data.error).toBe('SIMULACAO_NAO_ENCONTRADA')
      const invalida = await chamar(`${T}/me/credit/requests`, 'POST', { produto: 'X' })
      expect(invalida.status).toBe(400)
    })

    it('400 PARAMETRO_INVALIDO para filtros inválidos', async () => {
      for (const url of [
        `${T}/me/sales?from=2026-13-01`,
        `${T}/me/sales?group_by=year`,
        `${T}/me/sales?from=2026-02-10&to=2026-02-01`,
        `${T}/me/receivables?status=PAGO`,
        `${T}/me/payables?status=ABERTO,QUITADO`,
        `${T}/me/statement?to=ontem`,
      ]) {
        const { status, data } = await chamar<{ error: string; mensagem: string }>(url)
        expect(status).toBe(400)
        expect(data.error).toBe('PARAMETRO_INVALIDO')
        expect(data.mensagem).toBeTruthy()
      }
    })

    it('série de vendas preenchida com zeros e pct com 1 casa', async () => {
      const { data } = await chamar<SalesReport>(
        `${T}/me/sales?from=${diaRelativo(-2)}&to=${diaRelativo(3)}`,
      )
      expect(data.serie.map((p) => p.periodo)).toEqual([-2, -1, 0, 1, 2, 3].map(diaRelativo))
      expect(data.serie.slice(2).every((p) => p.valor === 0 && p.quantidade === 0)).toBe(true)
      for (const item of [...data.por_canal, ...data.por_forma_pagamento]) {
        expect(Math.round(item.pct * 10) / 10).toBe(item.pct)
      }
      const semana = await chamar<SalesReport>(`${T}/me/sales?group_by=week`)
      expect(semana.data.serie.every((p) => new Date(`${p.periodo}T12:00:00`).getDay() === 1)).toBe(
        true,
      )
    })

    it('estoque marca cobertura, abaixo do mínimo e parado por item', async () => {
      const { data } = await chamar<InventoryReport>(`${T}/me/inventory`)
      expect(data.abaixo_minimo).toBe(data.itens.filter((i) => i.abaixo_minimo).length)
      expect(data.itens.filter((i) => i.parado).every((i) => i.giro_dias > 90)).toBe(true)
      const baixo = data.itens.find((i) => i.abaixo_minimo)!
      expect(baixo.cobertura_dias).toBeLessThan(baixo.giro_dias)
    })

    it('pendências com ids e datas do contrato, sem credito nulo', async () => {
      const { data } = await chamar<Pendencia[]>(`${T}/me/pendencias`)
      for (const p of data) {
        expect(p.id).toMatch(
          /^(saldo-insuficiente|payable-\d+|inventory-(low|idle)-\d+|credit-(request|offer)-[\w-]+)$/,
        )
        expect(p.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect('credito' in p.acao ? p.acao.credito : 'omitido').not.toBeNull()
      }
      expect(data.some((p) => p.tipo === 'CONTA_ATRASADA' && !('credito' in p.acao))).toBe(true)
    })

    it('proposta pendente vira pendência', async () => {
      const ofertas = await chamar<CreditOffer[]>(`${T}/me/credit/offers`)
      const limite = ofertas.data.find((o) => o.produto === 'CAPITAL_DE_GIRO')!.limite
      const proposta = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
        produto: 'CAPITAL_DE_GIRO',
        valor: limite * 1.2,
        prazo_meses: 12,
      })
      const { data } = await chamar<Pendencia[]>(`${T}/me/pendencias`)
      expect(data.map((p) => p.id)).toContain(`credit-request-${proposta.data.id}`)
    })

    it('extrato filtra por período', async () => {
      const todos = await chamar<StatementEntry[]>(`${T}/me/statement`)
      expect(todos.data.length).toBeGreaterThan(30)
      // Mais recente primeiro, com instante ISO.
      expect(todos.data[0].data >= todos.data[1].data).toBe(true)
      expect(todos.data[0].data).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      const de = todos.data[5].data.slice(0, 10)
      const filtrado = await chamar<StatementEntry[]>(`${T}/me/statement?from=${de}&to=${de}`)
      expect(filtrado.data.length).toBeGreaterThan(0)
      expect(filtrado.data.every((e) => e.data.startsWith(de))).toBe(true)
    })
  })
})
