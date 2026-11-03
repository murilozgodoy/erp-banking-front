import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import * as db from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import type { FluxoCaixaDia, Kpi, Oportunidade } from '../../types'
import {
  amountToCover,
  creditBridge,
  findVales,
  lowestPoint,
  shortMoney,
  valeRange,
} from './cashflow'
import { benchmarkDiff, formatKpi } from './kpis'
import { OverviewPage } from './OverviewPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const TX = 'http://transactions.test'
const SCORE = 'http://score.test'

function dia(data: string, saldo: number, entradas = 0, saidas = 0): FluxoCaixaDia {
  return { data, entradas, saidas, saldo_projetado: saldo }
}

function oferta(tipo: Oportunidade['tipo'], valor_maximo: number): Oportunidade {
  return {
    tipo,
    titulo: tipo,
    descricao: '',
    valor_maximo,
    taxa_mensal: 1.5,
    prazo_max_meses: 6,
    racional: '',
  }
}

describe('cálculo do vale e da ponte de crédito', () => {
  const fluxo = [
    dia('2026-11-17', 1000),
    dia('2026-11-18', -500),
    dia('2026-11-19', -38_000),
    dia('2026-11-20', -100),
    dia('2026-11-21', 200),
    dia('2026-11-30', -10),
  ]

  it('encontra cada trecho negativo, com início, fim, duração e mínimo', () => {
    const [primeiro, segundo] = findVales(fluxo)
    expect(primeiro).toEqual({
      inicio: '2026-11-18',
      fim: '2026-11-20',
      dias: 3,
      minimo: -38_000,
      minimoData: '2026-11-19',
    })
    expect(segundo.fim).toBeNull()
    expect(findVales([dia('2026-11-17', 10)])).toEqual([])
    expect(lowestPoint(fluxo)).toEqual({ valor: -38_000, data: '2026-11-19' })
    expect(lowestPoint([])).toBeNull()
  })

  it('escreve o período do vale em pt-BR', () => {
    expect(valeRange({ inicio: '2026-11-18', fim: '2026-11-26' })).toBe('de 18 a 26 nov')
    expect(valeRange({ inicio: '2026-11-28', fim: '2026-12-03' })).toBe('de 28 nov a 03 dez')
    expect(valeRange({ inicio: '2026-11-18', fim: '2026-11-18' })).toBe('em 18 nov')
    expect(valeRange({ inicio: '2026-11-18', fim: null })).toBe('a partir de 18 nov')
  })

  it('sugere a antecipação que cobre o mínimo com folga, ou o capital de giro', () => {
    expect(amountToCover(-38_000)).toBe(42_000)
    expect(amountToCover(500)).toBe(0)
    expect(creditBridge(-38_000, [oferta('ANTECIPACAO_RECEBIVEIS', 80_000)])).toMatchObject({
      valor: 42_000,
      cobre: true,
      oportunidade: { tipo: 'ANTECIPACAO_RECEBIVEIS' },
    })
    expect(
      creditBridge(-38_000, [
        oferta('ANTECIPACAO_RECEBIVEIS', 20_000),
        oferta('CAPITAL_DE_GIRO', 90_000),
      ]),
    ).toMatchObject({ valor: 42_000, oportunidade: { tipo: 'CAPITAL_DE_GIRO' } })
    expect(
      creditBridge(-38_000, [
        oferta('ANTECIPACAO_RECEBIVEIS', 20_000),
        oferta('CAPITAL_DE_GIRO', 30_000),
      ]),
    ).toMatchObject({ valor: 30_000, cobre: false })
    expect(creditBridge(-38_000, [oferta('ALAVANCAGEM', 90_000)])).toBeNull()
    expect(creditBridge(100, [oferta('ANTECIPACAO_RECEBIVEIS', 90_000)])).toBeNull()
    expect(shortMoney(42_000)).toBe('R$ 42 mil')
  })
})

describe('KPIs na unidade do contrato', () => {
  const kpi = (valor: number, unidade: string, benchmark: number | null = 10): Kpi => ({
    id: 'receita_mensal',
    label: 'x',
    valor,
    unidade,
    benchmark_segmento: benchmark,
    leitura: '',
  })

  it('formata BRL, PCT, DIAS, X e unidades desconhecidas', () => {
    expect(formatKpi(31.2, 'BRL')).toMatch(/^R\$\s31,20$/)
    expect(formatKpi(182_000, 'BRL')).toMatch(/R\$\s182\smil/)
    expect(formatKpi(58, 'PCT')).toBe('58,0%')
    expect(formatKpi(12, 'DIAS')).toBe('12 dias')
    expect(formatKpi(1, 'DIAS')).toBe('1 dia')
    expect(formatKpi(1.4, 'X')).toBe('1,40×')
    expect(formatKpi(3, 'PONTOS')).toBe('3,00')
  })

  it('compara com o segmento só quando há benchmark', () => {
    expect(benchmarkDiff(kpi(12, 'DIAS', 10))).toBeCloseTo(20)
    expect(benchmarkDiff(kpi(12, 'DIAS', null))).toBeNull()
    expect(benchmarkDiff(kpi(12, 'DIAS', 0))).toBeNull()
  })
})

describe('Visão geral', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  const render = () => renderPortal(<OverviewPage />)

  it('mostra saudação, caixa com o vale e a Leitura da ErpIa com a oportunidade principal', async () => {
    const user = userEvent.setup()
    render()
    const nome = db.me().empresa!.nome_fantasia
    expect(
      await screen.findByRole('heading', { level: 1, name: new RegExp(nome) }),
    ).toBeInTheDocument()

    const caixa = await screen.findByRole('region', { name: 'Caixa projetado — 60 dias' })
    expect(within(caixa).getByText('Saldo hoje')).toBeInTheDocument()
    expect(within(caixa).getByText('Menor saldo do período')).toBeInTheDocument()
    expect(
      within(caixa).getByRole('img', { name: 'Caixa projetado nos próximos 60 dias' }),
    ).toBeInTheDocument()
    const fluxo = db.overview().fluxo_caixa
    const [vale] = findVales(fluxo)
    const range = valeRange(vale)
    expect(within(caixa).getByText(new RegExp(`Vale de caixa ${range}`))).toBeInTheDocument()

    // Leitura da ErpIa: resumo, sinais no "Ler análise completa" e a oferta que cobre o vale.
    const leitura = await screen.findByRole('region', { name: /Leitura da ErpIa/ })
    expect(within(leitura).getByText(/Padaria com receita acima da média/)).toBeInTheDocument()
    // 2 sinais sempre visíveis; o expandido mostra o resto.
    expect(within(leitura).getAllByRole('listitem')).toHaveLength(2)
    expect(within(leitura).getByText('Ponto forte:')).toBeInTheDocument()
    expect(within(leitura).getByText('Atenção:')).toBeInTheDocument()
    await user.click(within(leitura).getByRole('button', { name: 'Ler análise completa' }))
    expect(within(leitura).getAllByRole('listitem').length).toBeGreaterThan(2)
    expect(
      within(leitura).getByText(/^Atualizada em \d{2}\/\d{2} às \d{2}:\d{2} · regras \+ IA$/),
    ).toBeInTheDocument()

    const valor = amountToCover(lowestPoint(fluxo)!.valor)
    expect(
      within(leitura).getByText(
        `Seu caixa fica negativo ${range}. Antecipar ${shortMoney(valor)} cobre o vale.`,
      ),
    ).toBeInTheDocument()
    expect(within(leitura).getByText('Pré-aprovado')).toBeInTheDocument()
    expect(
      within(leitura).getByRole('link', { name: 'Simular antecipação de recebíveis' }),
    ).toHaveAttribute('href', `/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=${valor}`)
  })

  it('mostra entradas e saídas do dia no tooltip do gráfico', async () => {
    const user = userEvent.setup()
    render()
    const chart = await screen.findByRole('img', { name: 'Caixa projetado nos próximos 60 dias' })
    chart.focus()
    await user.keyboard('{ArrowRight}')
    const tooltip = await screen.findByText('Entradas')
    expect(tooltip.closest('[role="status"]')).toHaveTextContent(/Saídas/)
  })

  it('mostra os indicadores principais e os operacionais com links', async () => {
    render()
    const band = await screen.findByRole('region', { name: 'Indicadores da empresa' })
    for (const label of [
      'Receita 30 dias',
      'Margem estimada',
      'Prazo médio de recebimento',
      'Ciclo de caixa',
      'Recebíveis 90 dias',
      'A pagar 30 dias',
      'Em atraso',
      'Estoque',
    ]) {
      expect(within(band).getByText(label)).toBeInTheDocument()
    }
    expect(within(band).getByText('no mês')).toBeInTheDocument()
    expect(await within(band).findByText(/^meta: \d+ dias$/)).toBeInTheDocument()
    expect(within(band).getByText(/^segmento: /)).toBeInTheDocument()
    expect(within(band).getByRole('link', { name: /Resolver/ })).toHaveAttribute(
      'href',
      '/app/pendencias',
    )
    const count = db.overview().pendencias_count
    expect(screen.getByRole('link', { name: new RegExp(`${count} pend`) })).toHaveAttribute(
      'href',
      '/app/pendencias',
    )
  })

  it('lista as outras oportunidades, sem repetir a principal', async () => {
    render()
    const painel = await screen.findByRole('region', { name: /Outras oportunidades/ })
    const itens = within(painel).getAllByRole('listitem')
    expect(itens).toHaveLength(db.analiseAtual()!.oportunidades.length - 1)
    expect(
      within(painel).queryByRole('link', { name: 'Simular antecipação de recebíveis' }),
    ).not.toBeInTheDocument()
    expect(within(painel).getByRole('link', { name: 'Simular capital de giro' })).toHaveAttribute(
      'href',
      expect.stringMatching(/produto=CAPITAL_DE_GIRO&valor=\d+/),
    )
  })

  it('mostra score na escala de faixas e os KPIs contra o segmento', async () => {
    render()
    const score = await screen.findByRole('region', { name: 'Score e saúde do negócio' })
    expect(within(score).getByText('Análise por IA + regras', { exact: false })).toBeInTheDocument()
    const meter = within(score).getByRole('meter', { name: 'Score do negócio' })
    expect(meter).toHaveAttribute('aria-valuenow', '742')
    expect(meter).toHaveAttribute('aria-valuetext', '742 de 1000, risco médio')
    const table = within(score).getByRole('table', {
      name: 'Indicadores do negócio: você e a média do segmento',
    })
    expect(within(table).getAllByRole('row')).toHaveLength(10)
    expect(within(table).getByText('Margem bruta')).toBeInTheDocument()
    expect(within(table).getAllByText(/\d+ dias$/).length).toBeGreaterThan(0)
    expect(within(table).getAllByText(/%$/).length).toBeGreaterThan(0)
    expect(within(table).getAllByText(/×$/).length).toBeGreaterThan(0)
    expect(within(score).getByRole('heading', { name: 'Pontos fortes' })).toBeInTheDocument()
    expect(within(score).getByRole('heading', { name: 'Riscos' })).toBeInTheDocument()
  })

  it('sem vale, diz que o caixa cobre os 60 dias', async () => {
    const base = db.overview()
    server.use(
      http.get(`${TX}/me/overview`, () =>
        HttpResponse.json({
          ...base,
          atrasados_total: 0,
          pendencias_count: 0,
          receita_30d_variacao_pct: null,
          fluxo_caixa: base.fluxo_caixa.map((d, i) => ({
            ...d,
            saldo_projetado: 50_000 + i * 100,
          })),
        }),
      ),
    )
    render()
    expect(await screen.findByText('Seu caixa cobre os próximos 60 dias')).toBeInTheDocument()
    expect(screen.queryByText(/^Vale de caixa (de|em|a partir)/)).not.toBeInTheDocument()
    expect(screen.getByText('nenhuma conta em atraso')).toBeInTheDocument()
    expect(screen.getByText('sem base de comparação')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma pendência hoje')).toBeInTheDocument()
  })

  it('com a análise em andamento, mostra o estado "analisando"', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${SCORE}/me/analysis`, () =>
        HttpResponse.json({
          customer_id: 1,
          status: 'EM_ANALISE',
          score: 0,
          faixa_risco: 'MEDIO',
          resumo: 'Estamos analisando os dados do seu negócio.',
          gerado_por: 'regras',
          atualizado_em: new Date().toISOString(),
          kpis: [],
          insights: [],
          oportunidades: [],
          pontos_fortes: [],
          riscos: [],
        }),
      ),
    )
    render()
    expect(await screen.findByText('Analisando o seu negócio')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Score e saúde do negócio' })).toBeNull()
    expect(await screen.findByText(/^Vale de caixa (de|em|a partir)/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Simular antecipação de/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Atualizar análise' }))
    expect(screen.getByText('Analisando o seu negócio')).toBeInTheDocument()
  })

  it('erro no overview mostra o problema e tenta de novo', async () => {
    const user = userEvent.setup()
    let falhar = true
    server.use(
      http.get(`${TX}/me/overview`, () =>
        falhar
          ? HttpResponse.json({ message: 'Serviço fora do ar' }, { status: 500 })
          : HttpResponse.json(db.overview()),
      ),
    )
    render()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não conseguimos carregar a visão geral',
    )
    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('region', { name: 'Caixa projetado — 60 dias' }),
    ).toBeInTheDocument()
  })

  it('erro na análise não derruba o caixa e permite tentar de novo', async () => {
    const user = userEvent.setup()
    let falhar = true
    server.use(
      http.get(`${SCORE}/me/analysis`, () =>
        falhar ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(db.analiseAtual()),
      ),
    )
    render()
    expect(
      await screen.findByRole('region', { name: 'Caixa projetado — 60 dias' }),
    ).toBeInTheDocument()
    const alerts = await screen.findAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('Não conseguimos carregar a análise do negócio')
    falhar = false
    await user.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0])
    expect(
      await screen.findByRole('region', { name: 'Score e saúde do negócio' }),
    ).toBeInTheDocument()
  })

  it('409 ONBOARDING_PENDENTE leva ao acompanhamento da análise', async () => {
    server.use(
      http.get(`${TX}/me/overview`, () =>
        HttpResponse.json({ error: 'ONBOARDING_PENDENTE', status: 'EM_ANALISE' }, { status: 409 }),
      ),
    )
    render()
    expect(await screen.findByText('Seu cadastro ainda está em análise')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acompanhar a análise' })).toHaveAttribute(
      'href',
      '/app/status',
    )
  })

  it('mostra esqueletos enquanto carrega', async () => {
    render()
    expect(screen.getByRole('status', { name: 'Carregando o caixa projetado' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Carregando o caixa projetado' })).toBeNull(),
    )
  })
})
