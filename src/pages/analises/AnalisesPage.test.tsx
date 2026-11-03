import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { analiseDe } from '@/portal/mocks/db'
import { useMockApi } from '@/portal/test/portal'
import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { AnalisesPage } from './AnalisesPage'
import {
  formatPhone,
  isOverdue,
  kpiValue,
  relativeInstant,
  reviewReasons,
  segmentoLabel,
  waitingTime,
} from './format'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const REVIEWS = `${env.onboardingApiUrl}/onboarding/reviews`
const DECISION = `${env.onboardingApiUrl}/onboarding/reviews/:id/decision`
const ANALYSIS = `${env.scoreApiUrl}/scores/analyses/:id`

const STAFF = ['review:onboarding', 'read:scores']

function renderQueue(permissions = STAFF, route = '/analises') {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions }))
  return renderPage(<AnalisesPage />, { route, path: '/analises' })
}

async function rows() {
  const table = await screen.findByRole('table', { name: /Fila de análise/ })
  return within(table).getAllByRole('row').slice(1)
}

async function openSheet(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog', { name })
}

describe('AnalisesPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: STAFF }))
  })

  it('exige a permissão review:onboarding', async () => {
    renderQueue(['read:customers'])
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
    expect(screen.getByText('review:onboarding')).toBeInTheDocument()
  })

  it('mostra o esqueleto e lista a fila do envio mais antigo para o mais novo', async () => {
    renderQueue()
    expect(await screen.findByRole('status', { name: 'Carregando a fila…' })).toBeInTheDocument()

    const linhas = await rows()
    expect(linhas.map((row) => within(row).getAllByRole('button')[0].textContent)).toEqual([
      'Vinícola Altos da Serra Ltda',
      'Transportes Rota Sul Ltda',
      'Ateliê Lume Cerâmica Artesanal Ltda',
      'Clínica Veterinária Quatro Patas Ltda',
    ])
    const rotaSul = linhas[1]
    expect(within(rotaSul).getByText('27.451.983/0001-', { exact: false })).toBeInTheDocument()
    expect(within(rotaSul).getByText('Serviços')).toBeInTheDocument()
    expect(within(rotaSul).getByText('471')).toBeInTheDocument()
    expect(within(rotaSul).getByText('Risco alto')).toBeInTheDocument()
    expect(within(rotaSul).getByText('Regras')).toBeInTheDocument()
    expect(within(rotaSul).getByText('há 2 dias')).toBeInTheDocument()
    expect(within(rotaSul).getByText(/^2 d/)).toBeInTheDocument()
    expect(within(rotaSul).getByText('(mais de 1 dia)')).toBeInTheDocument()
    expect(within(linhas[3]).getByText('Regras + IA')).toBeInTheDocument()
    expect(screen.getByText('4 empresas')).toBeInTheDocument()
  })

  it('filtra por status e ensina no estado vazio', async () => {
    renderQueue()
    await rows()
    await userEvent.click(screen.getByRole('radio', { name: 'Aprovadas' }))
    expect(await screen.findByText('Nenhuma empresa aprovada ainda')).toBeInTheDocument()
    expect(screen.getByText('0 empresas')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Na fila há/ })).not.toBeInTheDocument()
  })

  it('fila vazia informa que não há empresas aguardando', async () => {
    server.use(http.get(REVIEWS, () => HttpResponse.json([])))
    renderQueue()
    expect(await screen.findByText('Nenhuma empresa aguardando análise')).toBeInTheDocument()
  })

  it('erro na fila mostra o problema e permite tentar de novo', async () => {
    server.use(
      http.get(REVIEWS, () => HttpResponse.json({ detail: 'Fora do ar' }, { status: 503 })),
    )
    renderQueue()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos carregar a fila')
    server.resetHandlers()
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await rows()).toHaveLength(4)
  })

  it('abre o detalhe com a análise completa do Score', async () => {
    renderQueue()
    const sheet = await openSheet('Transportes Rota Sul Ltda')
    expect(within(sheet).getByText('financeiro@rotasul.com.br')).toBeInTheDocument()
    expect(within(sheet).getByText('(41) 93322-1144')).toBeInTheDocument()
    expect(within(sheet).getByText(/Renovamos a frota em 2025/)).toBeInTheDocument()

    expect(await within(sheet).findByText('Indicadores')).toBeInTheDocument()
    expect(within(sheet).getByText('Receita mensal')).toBeInTheDocument()
    expect(within(sheet).getByText('R$ 520.000,00')).toBeInTheDocument()
    expect(within(sheet).getByText('3,7×')).toBeInTheDocument()
    expect(within(sheet).getByText('Endividamento crítico')).toBeInTheDocument()
    expect(within(sheet).getByText('Dívida acima de 3× o faturamento')).toBeInTheDocument()
    // Insights (IA) levam a Faísca; a leitura de "regras" não.
    expect(within(sheet).getAllByRole('img', { name: 'Escrito pela IA da ErpIa' })).toHaveLength(1)
  })

  it('mostra motivos e oportunidades quando a API os manda', async () => {
    server.use(
      http.get(ANALYSIS, ({ params }) =>
        HttpResponse.json({
          ...analiseDe(Number(params.id)),
          gerado_por: 'llm+regras',
          motivos_revisao: ['SEGMENTO_OUTRO', 'DIVIDA_ACIMA_3X'],
          oportunidades: [
            {
              tipo: 'CAPITAL_DE_GIRO',
              titulo: 'Capital de giro',
              descricao: 'Para o caixa',
              valor_maximo: 40000,
              taxa_mensal: 2.49,
              prazo_max_meses: 12,
              racional: 'Cobre o vale do fim do mês',
            },
          ],
        }),
      ),
    )
    renderQueue()
    const sheet = await openSheet('Ateliê Lume Cerâmica Artesanal Ltda')
    expect(await within(sheet).findByText('Por que veio para a fila')).toBeInTheDocument()
    expect(within(sheet).getByText('Segmento “outro”: fora dos templates')).toBeInTheDocument()
    expect(within(sheet).getByText('Divida acima 3x')).toBeInTheDocument()
    expect(within(sheet).getByText('Cobre o vale do fim do mês')).toBeInTheDocument()
    expect(within(sheet).getByText('até R$ 40.000,00')).toBeInTheDocument()
  })

  it('sem análise completa no Score, orienta a decidir pelo resumo', async () => {
    server.use(http.get(ANALYSIS, () => HttpResponse.json({ detail: 'x' }, { status: 404 })))
    renderQueue()
    const sheet = await openSheet('Ateliê Lume Cerâmica Artesanal Ltda')
    expect(await within(sheet).findByText(/ainda não tem a análise completa/)).toBeInTheDocument()
  })

  it('erro na análise completa permite tentar de novo', async () => {
    server.use(
      http.get(ANALYSIS, () => HttpResponse.json({ detail: 'Score fora' }, { status: 502 })),
    )
    renderQueue()
    const sheet = await openSheet('Ateliê Lume Cerâmica Artesanal Ltda')
    const alert = await within(sheet).findByRole('alert')
    expect(alert).toHaveTextContent('Score fora')
    server.resetHandlers()
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(sheet).findByText('Indicadores')).toBeInTheDocument()
  })

  it('aprova com confirmação, tira da fila e confirma', async () => {
    const decisions: unknown[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST') decisions.push(await request.clone().json())
    })
    renderQueue()
    const sheet = await openSheet('Clínica Veterinária Quatro Patas Ltda')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aprovar' }))
    expect(within(sheet).getByText(/libera o portal e a conta/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aprovar' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar aprovação' }))

    expect(
      await screen.findByText(/Clínica Veterinária Quatro Patas Ltda aprovada/),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(async () => expect(await rows()).toHaveLength(3))
    expect(decisions).toEqual([{ decisao: 'APROVADO', comentario: '' }])
    server.events.removeAllListeners()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    await waitFor(() => expect(screen.queryByText(/aprovada\./)).not.toBeInTheDocument())
  })

  it('reprovar exige comentário', async () => {
    renderQueue()
    const sheet = await openSheet('Transportes Rota Sul Ltda')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Reprovar' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar reprovação' }))
    expect(within(sheet).getByText(/Escreva o motivo/)).toBeInTheDocument()

    await userEvent.type(
      within(sheet).getByLabelText(/Motivo da reprovação/),
      'Endividamento acima da política.',
    )
    expect(within(sheet).queryByText(/Escreva o motivo/)).not.toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByText(/Transportes Rota Sul Ltda reprovada/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Reprovadas' }))
    expect(await rows()).toHaveLength(1)
    // Decididas não têm ações de decisão.
    const lida = await openSheet('Transportes Rota Sul Ltda')
    expect(within(lida).queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('409: avisa que outra pessoa decidiu e atualiza a fila', async () => {
    server.use(
      http.post(DECISION, () =>
        HttpResponse.json({ detail: 'Decisão só é permitida em ANALISE_MANUAL' }, { status: 409 }),
      ),
    )
    renderQueue()
    const sheet = await openSheet('Ateliê Lume Cerâmica Artesanal Ltda')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aprovar' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar aprovação' }))

    expect(await screen.findByText(/já foi decidida por outra pessoa/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // O mock ainda tem a empresa na fila: a recarga a traz de volta, como o servidor manda.
    await waitFor(async () => expect(await rows()).toHaveLength(4))
  })

  it('erro na decisão desfaz a remoção e explica no detalhe', async () => {
    server.use(
      http.post(DECISION, () => HttpResponse.json({ detail: 'Onboarding fora' }, { status: 503 })),
    )
    renderQueue()
    const sheet = await openSheet('Ateliê Lume Cerâmica Artesanal Ltda')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aprovar' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar aprovação' }))

    const alert = await within(sheet).findByRole('alert')
    expect(alert).toHaveTextContent('Não registramos a decisão: Onboarding fora')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await rows()).toHaveLength(4)
    expect(
      screen.getByText('Ateliê Lume Cerâmica Artesanal Ltda', { selector: 'button' }),
    ).toBeInTheDocument()
  })

  it('aceita o status pela URL', async () => {
    renderQueue(STAFF, '/analises?status=EM_ANALISE')
    expect(await screen.findByText('Nenhuma empresa em análise automática')).toBeInTheDocument()
  })
})

describe('formatação da fila', () => {
  const now = new Date(2026, 10, 3, 12, 0).getTime()

  it('tempo de espera e atraso', () => {
    expect(waitingTime(new Date(now - 45 * 60_000).toISOString(), now)).toBe('45 min')
    expect(waitingTime(new Date(now - 5 * 3_600_000).toISOString(), now)).toBe('5 h')
    expect(waitingTime(new Date(now - 48 * 3_600_000).toISOString(), now)).toBe('2 d')
    expect(waitingTime(new Date(now - 51 * 3_600_000).toISOString(), now)).toBe('2 d 3 h')
    expect(isOverdue(new Date(now - 25 * 3_600_000).toISOString(), now)).toBe(true)
    expect(isOverdue(new Date(now - 3_600_000).toISOString(), now)).toBe(false)
  })

  it('datas relativas, segmentos, KPIs e motivos', () => {
    const today = new Date(now)
    expect(relativeInstant(new Date(now - 3_600_000).toISOString(), today)).toBe('hoje')
    expect(relativeInstant(new Date(now - 86_400_000).toISOString(), today)).toBe('ontem')
    expect(relativeInstant('x', today)).toBe('—')
    expect(segmentoLabel(null)).toBe('—')
    expect(segmentoLabel('novo')).toBe('novo')
    expect(kpiValue({ valor: 30, unidade: 'DIAS' })).toBe('30 dias')
    expect(kpiValue({ valor: 1, unidade: 'DIAS' })).toBe('1 dia')
    expect(kpiValue({ valor: 12.5, unidade: 'PCT' })).toBe('12,5%')
    expect(kpiValue({ valor: 2.5, unidade: 'OUTRA' })).toBe('2,5')
    expect(formatPhone('4133221144')).toBe('(41) 3322-1144')
    expect(formatPhone('123')).toBe('123')
    expect(reviewReasons(null)).toEqual([])
    expect(reviewReasons({ motivos: ['LLM_ESPECIFICO', ''] })).toEqual([
      'A IA classificou o negócio como específico',
    ])
  })
})
