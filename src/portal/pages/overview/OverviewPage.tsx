import { isAxiosError } from 'axios'
import { ArrowRight, Hourglass, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Faisca, Marca } from '@/components/brand/Logo'
import { errorMessage } from '@/lib/errors'
import { useAnalysis, useMe, useOverview } from '../../layout/queries'
import { Button, ButtonLink } from '../../ui/Button'
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
import { KpiBand } from './KpiBand'
import { LeituraCard } from './LeituraCard'
import { OtherOpportunities } from './OtherOpportunities'
import { mainOffer } from './cashflow'
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
  const oportunidades = ready ? analysis.oportunidades : []
  const principal = ready ? mainOffer(overview.fluxo_caixa, oportunidades) : null
  const outras = oportunidades.filter((o) => o.tipo !== principal?.oportunidade.tipo)

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

  // Ordem no DOM = ordem no mobile: indicadores, Leitura, caixa, outras ofertas, score. No xl a
  // linha principal vira 2/3 + 1/3 com as duas colunas da mesma altura (o caixa vem antes).
  return (
    <>
      <KpiBand
        overview={overview}
        analysis={ready ? analysis : undefined}
        analysisPending={analysisSlot === 'loading'}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col xl:order-2">
          {ready ? (
            <LeituraCard analysis={analysis} offer={principal} className="h-full" />
          ) : (
            analysisFallback('Carregando a leitura da ErpIa')
          )}
        </div>
        <CashPanel
          className="min-w-0 xl:order-1"
          saldo={overview.saldo}
          fluxo={overview.fluxo_caixa}
          oportunidades={[]}
        />
      </div>
      {ready && <OtherOpportunities oportunidades={outras} />}
      {ready ? (
        <ScorePanel analysis={analysis} />
      ) : analysisSlot === 'analyzing' ? null : (
        analysisFallback('Carregando o score e a saúde do negócio')
      )}
    </>
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
  return (
    <>
      <div
        role="status"
        aria-label="Carregando os indicadores"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-surface px-4 py-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="xl:order-2">
          <PanelSkeleton rows={7} label="Carregando a leitura da ErpIa" />
        </div>
        <div
          role="status"
          aria-label="Carregando o caixa projetado"
          className="rounded-panel border border-line bg-surface p-5 shadow-raised xl:order-1"
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          <Skeleton className="mt-6 h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-56" />
          <Skeleton className="mt-6 h-[280px] w-full" />
        </div>
      </div>
      <PanelSkeleton rows={6} label="Carregando o score e a saúde do negócio" />
    </>
  )
}
