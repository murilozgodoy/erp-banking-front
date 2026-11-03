import { isAxiosError } from 'axios'
import { ArrowRight, Hourglass, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Faisca, Marca } from '@/components/brand/Logo'
import { errorMessage } from '@/lib/errors'
import { useAnalysis, useMe, useOverview } from '../../layout/queries'
import { money } from '../../lib/format'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { Button, ButtonLink } from '../../ui/Button'
import { Delta } from '../../ui/Delta'
import { StatStrip, type Stat } from '../../ui/StatStrip'
import {
  EmptyState,
  ErrorState,
  Panel,
  PanelSkeleton,
  PageHeader,
  Skeleton,
} from '../../ui/Surface'
import type { BusinessAnalysis, Overview } from '../../types'

import { CashPanel } from './CashPanel'
import { OpportunitiesPanel } from './OpportunitiesPanel'
import { ReadingPanel } from './ReadingPanel'
import { ScorePanel } from './ScorePanel'

const todayFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** 409 das rotas `/me` do Transactions enquanto o cadastro não foi aprovado. */
function isOnboardingPendente(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    (error.response.data as { error?: string } | undefined)?.error === 'ONBOARDING_PENDENTE'
  )
}

/** Visão geral (`/app`): a situação financeira da empresa num relance, com o crédito que ajuda. */
export function OverviewPage() {
  const me = useMe()
  const overview = useOverview()
  const analysis = useAnalysis()

  const now = new Date()
  const nome = me.data?.empresa?.nome_fantasia
  const emAnalise = analysis.data?.status === 'EM_ANALISE'

  return (
    <div className="space-y-4">
      <PageHeader
        title={nome ? `${greeting(now)}, ${nome}` : greeting(now)}
        description={
          <span className="block first-letter:uppercase">{todayFormat.format(now)}</span>
        }
        actions={overview.data && <PendenciasTeaser count={overview.data.pendencias_count} />}
      />

      {overview.isPending ? (
        <OverviewSkeleton />
      ) : overview.isError ? (
        isOnboardingPendente(overview.error) ? (
          <Panel>
            <EmptyState
              icon={<Hourglass className="size-5" />}
              title="Seu cadastro ainda está em análise"
              action={
                <ButtonLink to="/app/status" variant="primary">
                  Acompanhar a análise
                </ButtonLink>
              }
            >
              O caixa, as vendas e o crédito aparecem aqui assim que a análise aprovar o cadastro da
              empresa.
            </EmptyState>
          </Panel>
        ) : (
          <ErrorState
            title="Não conseguimos carregar a visão geral"
            message={errorMessage(overview.error)}
            onRetry={() => void overview.refetch()}
          />
        )
      ) : (
        <Loaded
          overview={overview.data}
          analysis={analysis.data}
          analysisSlot={
            analysis.isPending
              ? 'loading'
              : analysis.isError
                ? 'error'
                : emAnalise
                  ? 'analyzing'
                  : 'ready'
          }
          analysisError={analysis.isError ? errorMessage(analysis.error) : undefined}
          retryAnalysis={() => void analysis.refetch()}
          refreshing={analysis.isFetching}
        />
      )}
    </div>
  )
}

type AnalysisSlot = 'loading' | 'error' | 'analyzing' | 'ready'

function Loaded({
  overview,
  analysis,
  analysisSlot,
  analysisError,
  retryAnalysis,
  refreshing,
}: {
  overview: Overview
  analysis: BusinessAnalysis | undefined
  analysisSlot: AnalysisSlot
  analysisError?: string
  retryAnalysis: () => void
  refreshing: boolean
}) {
  const ready = analysisSlot === 'ready' && analysis
  const wide = useMediaQuery('(min-width: 1280px)')
  const oportunidades = ready ? analysis.oportunidades : []

  const analysisFallback = (label: string): ReactNode => {
    if (analysisSlot === 'loading') return <PanelSkeleton rows={6} label={label} />
    if (analysisSlot === 'error')
      return (
        <ErrorState
          title="Não conseguimos carregar a análise do negócio"
          message={analysisError ?? ''}
          onRetry={retryAnalysis}
        />
      )
    return <Analyzing onRefresh={retryAnalysis} refreshing={refreshing} />
  }

  const reading = ready ? (
    <ReadingPanel analysis={analysis} />
  ) : (
    analysisFallback('Carregando a leitura da ErpIa')
  )
  const opportunities =
    ready || analysisSlot === 'loading' ? (
      ready ? (
        <OpportunitiesPanel oportunidades={oportunidades} />
      ) : (
        <PanelSkeleton rows={6} label="Carregando as oportunidades de crédito" />
      )
    ) : null
  const cash = (
    <CashPanel
      saldo={overview.saldo}
      fluxo={overview.fluxo_caixa}
      oportunidades={oportunidades}
      analysisPending={analysisSlot === 'loading'}
    />
  )
  const kpis = (
    <section aria-label="Indicadores dos últimos 30 dias">
      <StatStrip stats={kpiStats(overview)} columns={wide ? 'three' : 'auto'} />
    </section>
  )
  const score = ready ? (
    <ScorePanel analysis={analysis} />
  ) : analysisSlot === 'analyzing' ? null : (
    analysisFallback('Carregando o score e a saúde do negócio')
  )

  // Desktop (≥ 1280 px): à esquerda caixa e indicadores; à direita leitura e ofertas (fixas no
  // scroll); o score ocupa a largura toda embaixo. Telas menores: Leitura → Caixa → Indicadores → Oportunidades → Score.
  if (wide) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-12 items-start gap-4">
          <div className="col-span-7 space-y-4">
            {cash}
            {kpis}
          </div>
          <aside
            aria-label="Leitura e crédito"
            className="sticky top-[4.5rem] col-span-5 space-y-4"
          >
            {reading}
            {opportunities}
          </aside>
        </div>
        {score}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {reading}
      {cash}
      {kpis}
      {opportunities}
      {score}
    </div>
  )
}

function kpiStats(o: Overview): Stat[] {
  const atrasado = o.atrasados_total > 0
  return [
    {
      label: 'Receita 30 dias',
      value: money(o.receita_30d),
      detail:
        o.receita_30d_variacao_pct === null ? (
          'Sem base de comparação'
        ) : (
          <Delta value={o.receita_30d_variacao_pct} context="vs. 30 dias anteriores" />
        ),
    },
    {
      label: 'Ticket médio',
      value: money(o.ticket_medio_30d),
      detail: 'por venda, 30 dias',
    },
    {
      label: 'Recebíveis 90 dias',
      value: money(o.recebiveis_90d),
      detail: <StatLink to="/app/recebiveis">Ver agenda</StatLink>,
    },
    {
      label: 'A pagar 30 dias',
      value: money(o.a_pagar_30d),
      detail: <StatLink to="/app/pagamentos">Ver contas</StatLink>,
    },
    {
      label: 'Em atraso',
      value: (
        <span className={atrasado ? 'text-negative' : undefined}>{money(o.atrasados_total)}</span>
      ),
      detail: atrasado ? (
        <StatLink to="/app/pendencias">Resolver em Pendências</StatLink>
      ) : (
        'Nenhuma conta em atraso'
      ),
    },
    {
      label: 'Estoque',
      value: money(o.estoque_valor),
      detail: <StatLink to="/app/estoque">a preço de custo</StatLink>,
    },
  ]
}

function StatLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
    >
      {children}
      <ArrowRight aria-hidden className="size-3" />
    </Link>
  )
}

function PendenciasTeaser({ count }: { count: number }) {
  if (count === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma pendência hoje</p>
  }
  return (
    <ButtonLink to="/app/pendencias" variant="secondary" size="sm">
      <span className="tabular grid min-w-5 place-items-center rounded-full bg-warning-soft px-1.5 text-xs font-semibold text-warning">
        {count}
      </span>{' '}
      {count === 1 ? 'pendência para resolver' : 'pendências para resolver'}
      <ArrowRight aria-hidden className="size-4" />
    </ButtonLink>
  )
}

/** A análise ainda está rodando (`EM_ANALISE`): ofertas e score chegam em seguida. */
function Analyzing({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <Panel className="h-full">
      <div role="status" className="flex h-full flex-col items-start gap-3 py-2">
        <span className="grid size-10 place-items-center rounded-full bg-credit-soft">
          <Faisca label={null} className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-ink">Analisando o seu negócio</p>
          <p className="mt-1 max-w-[52ch] text-sm text-ink-muted">
            A <Marca /> está lendo vendas, contas e recebíveis para calcular o score e as ofertas de
            crédito pré-aprovadas. Leva poucos segundos.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          icon={<RotateCw className="size-4" />}
          onClick={onRefresh}
        >
          Atualizar análise
        </Button>
      </div>
    </Panel>
  )
}

/** Esqueleto no mesmo desenho da página carregada (gráfico 8 + ofertas 4, faixa, score). */
function OverviewSkeleton() {
  const wide = useMediaQuery('(min-width: 1280px)')
  const reading = <PanelSkeleton rows={4} label="Carregando a leitura da ErpIa" />
  const cash = (
    <div
      role="status"
      aria-label="Carregando o caixa projetado"
      className="rounded-panel border border-line bg-surface p-5 shadow-raised"
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      <Skeleton className="mt-6 h-3 w-20" />
      <Skeleton className="mt-2 h-9 w-56" />
      <Skeleton className="mt-6 h-[280px] w-full" />
    </div>
  )
  const kpis = (
    <StatStrip
      loading
      columns={wide ? 'three' : 'auto'}
      stats={[
        'Receita 30 dias',
        'Ticket médio',
        'Recebíveis 90 dias',
        'A pagar 30 dias',
        'Em atraso',
        'Estoque',
      ].map((label) => ({ label, value: null }))}
    />
  )
  const opportunities = <PanelSkeleton rows={6} label="Carregando as oportunidades de crédito" />
  const score = <PanelSkeleton rows={6} label="Carregando o score e a saúde do negócio" />
  if (wide) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-12 items-start gap-4">
          <div className="col-span-7 space-y-4">
            {cash}
            {kpis}
          </div>
          <div className="col-span-5 space-y-4">
            {reading}
            {opportunities}
          </div>
        </div>
        {score}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {reading}
      {cash}
      {kpis}
      {opportunities}
      {score}
    </div>
  )
}
