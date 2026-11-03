import { useAuth0 } from '@auth0/auth0-react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import { portalKeys } from '../../layout/queries'
import * as db from '../../mocks/db'
import { renderPortal, useMockApi } from '../../test/portal'
import { CONFIRMACAO_MS, FAIXA, hasReading, isAiReading, momento, scoreOf } from './analysis'
import {
  missingAnalysis,
  pollInterval,
  POLL_AUTOMATICA_MS,
  POLL_MANUAL_MS,
  reviewComment,
} from './queries'
import { StatusPage } from './StatusPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

beforeEach(() => {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
})

afterEach(() => {
  vi.useRealTimers()
})

const ME = `${env.onboardingApiUrl}/me`
const DRAFT = `${env.onboardingApiUrl}/me/onboarding`
const ANALYSIS = `${env.scoreApiUrl}/me/analysis`

function renderStatus() {
  return renderPortal(<StatusPage />, { route: '/app/status', path: '/app/status' })
}

describe('StatusPage: análise automática', () => {
  const server = useMockApi('EM_ANALISE')

  it('mostra o esqueleto e depois a linha do tempo, sem barra de progresso', async () => {
    renderStatus()
    expect(screen.getByRole('status', { name: 'Carregando a análise…' })).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/alguns segundos a um minuto/)).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Etapas da análise' })).getAllByRole(
      'listitem',
    )
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveTextContent('Cadastro recebido: concluída')
    expect(await within(steps[0]).findByText(/Enviado hoje às/)).toBeInTheDocument()
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).toHaveTextContent('Análise automática: em andamento')
    expect(steps[2]).toHaveTextContent('Decisão: a seguir')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Análise automática em andamento.')).toBeInTheDocument()
  })

  it('aceita o 200 em análise com campos vazios da API real', async () => {
    server.use(
      http.get(ANALYSIS, () =>
        HttpResponse.json({
          customer_id: db.CUSTOMER_ID,
          status: 'EM_ANALISE',
          score: null,
          faixa_risco: null,
          resumo: null,
          gerado_por: null,
          atualizado_em: null,
          kpis: [],
          insights: [],
          oportunidades: [],
          pontos_fortes: [],
          riscos: [],
        }),
      ),
    )
    renderStatus()
    expect(
      await screen.findByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Prévia da análise')).not.toBeInTheDocument()
  })

  it('avisa com honestidade quando a análise passa do tempo normal', async () => {
    server.use(
      http.get(DRAFT, () =>
        HttpResponse.json({
          ...db.rascunho(),
          updated_at: new Date(Date.now() - 3 * 60_000).toISOString(),
        }),
      ),
    )
    renderStatus()
    expect(await screen.findByText(/Está levando mais que o normal/)).toBeInTheDocument()
  })

  it('aprova pelo polling: confirma e depois libera o portal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { queryClient } = renderStatus()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    expect(
      await screen.findByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()

    // A análise do mock termina 8 s após o envio; o polling de 4 s pega a virada aos 8 s.
    await act(() => vi.advanceTimersByTimeAsync(db.ANALISE_MS + 200))
    expect(await screen.findByRole('heading', { name: 'Cadastro aprovado' })).toBeInTheDocument()
    expect(screen.getByText('Cadastro aprovado. Liberando o portal.')).toBeInTheDocument()
    expect(invalidate).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(CONFIRMACAO_MS))
    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/app$/)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: portalKeys.me })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: portalKeys.analysis })
  })

  it('não apaga a tela quando uma consulta periódica falha', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderStatus()
    expect(
      await screen.findByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()

    server.use(http.get(ME, () => HttpResponse.json({ detail: 'falhou' }, { status: 503 })))
    await act(() => vi.advanceTimersByTimeAsync(POLL_AUTOMATICA_MS + 100))

    expect(await screen.findByText(/Não conseguimos atualizar agora/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()
  })

  it('mostra o erro com "Tentar de novo" quando o primeiro carregamento falha', async () => {
    server.use(http.get(ME, () => HttpResponse.json({ detail: 'fora' }, { status: 503 })))
    renderStatus()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos consultar a análise')
    expect(alert).toHaveTextContent('fora')

    server.resetHandlers()
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeInTheDocument()
  })
})

describe('StatusPage: análise manual', () => {
  const server = useMockApi('ANALISE_MANUAL')

  it('explica a revisão humana e mostra a prévia com a Faísca só na leitura da IA', async () => {
    renderStatus()
    expect(
      await screen.findByRole('heading', { name: 'Seu cadastro está com um analista' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/não indica reprovação/)).toBeInTheDocument()
    expect(screen.getAllByText(/até 1 dia útil/)).toHaveLength(2)
    expect(screen.getByText(db.EMPRESA_AURORA.email!)).toBeInTheDocument()

    const steps = within(screen.getByRole('list', { name: 'Etapas da análise' })).getAllByRole(
      'listitem',
    )
    expect(steps).toHaveLength(4)
    expect(steps[1]).toHaveTextContent('Análise automática: concluída')
    expect(steps[2]).toHaveAttribute('aria-current', 'step')

    const previa = await screen.findByRole('region', { name: 'Prévia da análise' })
    expect(within(previa).getByText('742')).toBeInTheDocument()
    expect(within(previa).getByText('Risco médio')).toBeInTheDocument()
    expect(within(previa).getByText(/Padaria com receita acima da média/)).toBeInTheDocument()
    expect(within(previa).getByText('Margem bruta acima da média de padarias')).toBeInTheDocument()
    expect(
      within(previa).getByText('Estoque parado em itens de cesta e importados'),
    ).toBeInTheDocument()
    // Leitura, pontos fortes e de atenção: 3 Faíscas; o score (regras) não leva.
    expect(within(previa).getAllByRole('img', { name: 'Escrito pela IA da ErpIa' })).toHaveLength(3)
  })

  it('sem análise encontrada, explica a revisão e não mostra prévia', async () => {
    server.use(
      http.get(ANALYSIS, () =>
        HttpResponse.json({ error: 'ANALISE_NAO_ENCONTRADA' }, { status: 404 }),
      ),
    )
    renderStatus()
    expect(
      await screen.findByRole('heading', { name: 'Seu cadastro está com um analista' }),
    ).toBeInTheDocument()
    await screen.findByText(/Enviado/)
    expect(screen.queryByRole('region', { name: 'Prévia da análise' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sem o resumo das regras, a prévia não leva Faísca', async () => {
    server.use(
      http.get(ANALYSIS, () =>
        HttpResponse.json({ ...db.analiseAtual(), gerado_por: 'regras', resumo: 'Só regras.' }),
      ),
    )
    renderStatus()
    const previa = await screen.findByRole('region', { name: 'Prévia da análise' })
    expect(within(previa).getByText('Só regras.')).toBeInTheDocument()
    expect(within(previa).queryByRole('img')).not.toBeInTheDocument()
  })

  it('erro na prévia não derruba a página e permite tentar de novo', async () => {
    server.use(
      http.get(ANALYSIS, () => HttpResponse.json({ detail: 'Score fora' }, { status: 502 })),
    )
    renderStatus()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos carregar a prévia da análise')
    expect(
      screen.getByRole('heading', { name: 'Seu cadastro está com um analista' }),
    ).toBeInTheDocument()

    server.resetHandlers()
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Prévia da análise' })).toBeInTheDocument()
  })

  it('sem e-mail no cadastro, cita o e-mail do cadastro', async () => {
    server.use(
      http.get(ME, () =>
        HttpResponse.json({ ...db.me(), empresa: { ...db.EMPRESA_AURORA, email: null } }),
      ),
    )
    renderStatus()
    expect(await screen.findByText(/pelo e-mail do cadastro/)).toBeInTheDocument()
  })

  it('consulta devagar na análise manual', () => {
    expect(pollInterval('ANALISE_MANUAL')).toBe(POLL_MANUAL_MS)
    expect(pollInterval('EM_ANALISE')).toBe(POLL_AUTOMATICA_MS)
    expect(pollInterval('REPROVADO')).toBe(false)
    expect(pollInterval(undefined)).toBe(false)
  })
})

describe('StatusPage: reprovado', () => {
  const server = useMockApi('REPROVADO')

  it('mostra a decisão com respeito, o comentário do analista e reabre o cadastro', async () => {
    renderStatus()
    expect(
      await screen.findByRole('heading', { name: 'Seu cadastro não foi aprovado agora' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(db.COMENTARIO_REPROVACAO)).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Etapas da análise' })).getAllByRole(
      'listitem',
    )
    expect(steps[2]).toHaveTextContent('Decisão: não aprovada')

    // O REPROVADO abre o wizard direto (routing.ts), sem regravar o envio como rascunho.
    const link = screen.getByRole('link', { name: 'Revisar e reenviar' })
    expect(link).toHaveAttribute('href', '/app/onboarding')
    await userEvent.click(link)

    expect(await screen.findByTestId('location')).toHaveTextContent('/app/onboarding')
    expect(db.me().onboarding_status).toBe('REPROVADO')
  })

  it('sem comentário, não mostra o bloco do analista', async () => {
    server.use(http.get(DRAFT, () => HttpResponse.json({ ...db.rascunho(), review_comment: null })))
    renderStatus()
    await screen.findByRole('heading', { name: 'Seu cadastro não foi aprovado agora' })
    await screen.findByText(/Enviado/)
    expect(screen.queryByText('Comentário do analista')).not.toBeInTheDocument()
  })

  it('comentário só com espaços não aparece', async () => {
    server.use(
      http.get(DRAFT, () => HttpResponse.json({ ...db.rascunho(), review_comment: '   ' })),
    )
    renderStatus()
    await screen.findByRole('heading', { name: 'Seu cadastro não foi aprovado agora' })
    await screen.findByText(/Enviado/)
    expect(screen.queryByText('Comentário do analista')).not.toBeInTheDocument()
  })
})

describe('StatusPage: aprovado e sem envio', () => {
  describe('aprovado', () => {
    useMockApi('APROVADO')

    it('abre o portal na hora pelo botão', async () => {
      renderStatus()
      await userEvent.click(await screen.findByRole('button', { name: 'Abrir o portal' }))
      expect(await screen.findByTestId('location')).toHaveTextContent(/^\/app$/)
    })
  })

  describe('sem cadastro', () => {
    useMockApi('NAO_INICIADO')

    it('404 ONBOARDING_NAO_INICIADO leva de volta ao cadastro', async () => {
      renderStatus()
      expect(await screen.findByText('Seu cadastro ainda não foi enviado')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Continuar o cadastro' })).toHaveAttribute(
        'href',
        '/app/onboarding',
      )
    })
  })

  describe('status desatualizado no /me', () => {
    const server = useMockApi('EM_ANALISE')

    it('trata o 404 ONBOARDING_NAO_INICIADO mesmo com o /me em análise', async () => {
      server.use(
        http.get(ANALYSIS, () =>
          HttpResponse.json({ error: 'ONBOARDING_NAO_INICIADO' }, { status: 404 }),
        ),
      )
      renderStatus()
      expect(await screen.findByText('Seu cadastro ainda não foi enviado')).toBeInTheDocument()
    })
  })
})

describe('helpers da análise', () => {
  const axios404 = (data: unknown) =>
    new AxiosError('404', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 404,
      statusText: 'Not Found',
      data,
      headers: {},
      config: { headers: new AxiosHeaders() },
    })

  it('lê os 404 do /me/analysis', () => {
    expect(missingAnalysis(axios404({ error: 'ONBOARDING_NAO_INICIADO' }))).toBe(
      'ONBOARDING_NAO_INICIADO',
    )
    expect(missingAnalysis(axios404({ error: 'ANALISE_NAO_ENCONTRADA' }))).toBe(
      'ANALISE_NAO_ENCONTRADA',
    )
    expect(missingAnalysis(axios404(undefined))).toBe('ANALISE_NAO_ENCONTRADA')
    expect(missingAnalysis(new Error('x'))).toBeNull()
  })

  it('formata o momento do envio', () => {
    const now = new Date(2026, 10, 3, 15, 0)
    expect(momento(new Date(2026, 10, 3, 14, 32).toISOString(), now)).toBe('hoje às 14:32')
    expect(momento(new Date(2026, 10, 2, 9, 5).toISOString(), now)).toMatch(
      /^2 de nov\.? às 09:05$/,
    )
    expect(momento('não é data', now)).toBe('')
  })

  it('reconhece score, leitura da IA e comentário', () => {
    expect(scoreOf({ score: 0 })).toBeNull()
    expect(scoreOf(null)).toBeNull()
    expect(scoreOf({ score: 700 })).toBe(700)
    expect(isAiReading('llm+regras')).toBe(true)
    expect(isAiReading('regras')).toBe(false)
    expect(hasReading(null)).toBe(false)
    expect(FAIXA.MUITO_ALTO.tone).toBe('negative')
    expect(reviewComment(undefined)).toBeNull()
    expect(reviewComment({ review_comment: '  ok  ' } as never)).toBe('ok')
    expect(reviewComment({ review_comment: '   ' } as never)).toBeNull()
  })
})
