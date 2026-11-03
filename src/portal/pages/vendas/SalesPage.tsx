import { motion, useReducedMotion } from 'motion/react'
import { CalendarRange, Hourglass } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useAnalysis } from '../../layout/queries'
import { money, number } from '../../lib/format'
import { Button, ButtonLink } from '../../ui/Button'
import { Delta } from '../../ui/Delta'
import { InsightBlock, type InsightOffer } from '../../ui/InsightBlock'
import { Money } from '../../ui/Money'
import { Segmented } from '../../ui/Segmented'
import { StatStrip, type Stat } from '../../ui/StatStrip'
import {
  EmptyState,
  ErrorState,
  Panel,
  PanelSkeleton,
  PageHeader,
  Skeleton,
} from '../../ui/Surface'
import type { BusinessAnalysis, GroupBy, SalesReport } from '../../types'

import {
  PERIODS,
  change,
  comparable,
  comparisonContext,
  defaultGroup,
  groupsFor,
  periodDays,
  readSelection,
  summarize,
  windows,
  writeSelection,
  type PeriodKey,
  type SalesSummary,
} from './period'
import { RevenueChart } from './RevenueChart'
import { SalesMix } from './SalesMix'
import { TopProducts } from './TopProducts'
import { isOnboardingPending, salesErrorMessage, useSalesReport } from './useSales'

/** Insight de vendas: o que fala de crédito/cartão primeiro, porque é o que tem ação. */
function salesInsight(analysis: BusinessAnalysis | undefined) {
  const insights = analysis?.insights.filter((i) => i.area === 'vendas') ?? []
  return insights.find((i) => i.severidade === 'oportunidade') ?? insights[0]
}

function antecipacaoOffer(
  analysis: BusinessAnalysis | undefined,
  report: SalesReport | undefined,
): InsightOffer | undefined {
  const oportunidade = analysis?.oportunidades.find((o) => o.tipo === 'ANTECIPACAO_RECEBIVEIS')
  if (!oportunidade) return undefined
  const credito = report?.por_forma_pagamento.find((f) => f.forma === 'CARTAO_CREDITO')
  return {
    produto: 'ANTECIPACAO_RECEBIVEIS',
    valor: oportunidade.valor_maximo,
    taxa_mensal: oportunidade.taxa_mensal,
    racional:
      credito && credito.pct > 0
        ? `${number(credito.pct, 0)}% das suas vendas são no cartão de crédito.`
        : oportunidade.racional,
    cta: 'Simular antecipação',
  }
}

/** Base de comparação: o relatório anterior, ainda carregando, ou indisponível (erro). */
type Baseline = SalesReport | 'loading' | 'error' | undefined

function SummaryStrip({
  report,
  previous,
  period,
}: {
  report: SalesReport
  previous: Baseline
  period: PeriodKey
}) {
  const days = periodDays(period)
  const now = summarize(report, days)
  const base =
    typeof previous === 'object' && comparable(previous) ? summarize(previous, days) : null
  const context = comparisonContext(period)
  const delta = (pick: (s: SalesSummary) => number) => {
    if (previous === 'loading') return <Skeleton className="h-4 w-32" />
    if (previous === 'error') return 'comparação indisponível agora'
    const value = base ? change(pick(now), pick(base)) : null
    return value === null ? (
      'sem histórico para comparar'
    ) : (
      <Delta value={value} context={context} />
    )
  }
  const stats: Stat[] = [
    {
      label: 'Faturamento do período',
      value: <Money value={now.total} size="lg" />,
      detail: delta((s) => s.total),
    },
    {
      label: 'Número de vendas',
      value: <span className="text-xl">{number(now.quantidade)}</span>,
      detail: delta((s) => s.quantidade),
    },
    {
      label: 'Ticket médio',
      value: <Money value={now.ticket} size="lg" />,
      detail: delta((s) => s.ticket),
    },
    {
      label: 'Média diária',
      value: <Money value={now.mediaDiaria} size="lg" />,
      detail: delta((s) => s.mediaDiaria),
    },
  ]
  return <StatStrip stats={stats} />
}

function LoadingLayout() {
  return (
    <div aria-busy="true" className="space-y-4">
      <StatStrip
        loading
        stats={['Faturamento do período', 'Número de vendas', 'Ticket médio', 'Média diária'].map(
          (label) => ({ label, value: null }),
        )}
      />
      <div className="rounded-panel border border-line bg-surface p-5 shadow-raised">
        <Skeleton className="mb-2 h-4 w-44" />
        <Skeleton className="mb-6 h-3 w-72 max-w-full" />
        <div aria-hidden className="flex h-52 items-end gap-1.5">
          {[38, 52, 46, 70, 88, 64, 42, 50, 58, 49, 76, 92, 60, 44].map((h, i) => (
            <span key={i} className="block flex-1 skeleton rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={3} label="Carregando formas de pagamento" />
        <PanelSkeleton rows={3} label="Carregando canais" />
      </div>
      <PanelSkeleton rows={6} label="Carregando produtos" />
    </div>
  )
}

/** Vendas: faturamento no tempo, mix de pagamento e canais, e o ranking de produtos. */
export function SalesPage() {
  const [params, setParams] = useSearchParams()
  const { period, group } = readSelection(params)
  const range = useMemo(() => windows(period), [period])
  const reduce = useReducedMotion()

  const current = useSalesReport(range.current, group)
  const previous = useSalesReport(range.previous, group)
  const analysis = useAnalysis()

  const select = (next: { period: PeriodKey; group: GroupBy }) =>
    setParams(writeSelection(params, next), { replace: true })

  const report = current.data
  const pending = isOnboardingPending(current.error)
  const longer = PERIODS.find((p) => p.days > periodDays(period))

  let body
  if (pending) {
    body = (
      <Panel>
        <EmptyState
          icon={<Hourglass aria-hidden className="size-5" />}
          title="Suas vendas aparecem quando o cadastro for aprovado"
          action={
            <ButtonLink to="/app/status" variant="secondary" size="sm">
              Ver andamento do cadastro
            </ButtonLink>
          }
        >
          Assim que a análise terminar, a ErpIa conecta o ERP e mostra o faturamento aqui.
        </EmptyState>
      </Panel>
    )
  } else if (current.isError && !report) {
    body = (
      <ErrorState message={salesErrorMessage(current.error)} onRetry={() => current.refetch()} />
    )
  } else if (!report) {
    body = <LoadingLayout />
  } else if (report.total <= 0) {
    body = (
      <Panel>
        <EmptyState
          icon={<CalendarRange aria-hidden className="size-5" />}
          title={`Nenhuma venda nos últimos ${periodDays(period)} dias`}
          action={
            longer && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => select({ period: longer.value, group: defaultGroup(longer.value) })}
              >
                Ver últimos {longer.days} dias
              </Button>
            )
          }
        >
          As vendas chegam do seu ERP uma vez por dia. Se a integração é recente, amplie o período;
          se faltar algo, confira se o ERP está enviando os pedidos fechados.
        </EmptyState>
      </Panel>
    )
  } else {
    body = (
      <motion.div
        className="space-y-4"
        aria-busy={current.isFetching || undefined}
        animate={{ opacity: current.isPlaceholderData ? 0.6 : 1 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
      >
        {current.isError && (
          <ErrorState
            title="Não conseguimos atualizar o período"
            message={`${salesErrorMessage(current.error)} Os números abaixo são da seleção anterior.`}
            onRetry={() => current.refetch()}
          />
        )}
        <SummaryStrip
          report={report}
          previous={
            previous.isError
              ? 'error'
              : !previous.data || (previous.isPlaceholderData && !current.isPlaceholderData)
                ? 'loading'
                : previous.data
          }
          period={period}
        />
        <RevenueChart report={report} group={group} />
        <SalesMix report={report} />
        <TopProducts report={report} />
      </motion.div>
    )
  }

  const insight = salesInsight(analysis.data)
  const offer = antecipacaoOffer(analysis.data, report)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendas"
        description="Faturamento, formas de pagamento, canais e produtos, direto do seu ERP."
        actions={
          <>
            <Segmented
              label="Período"
              value={period}
              options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(next) => select({ period: next, group: defaultGroup(next) })}
            />
            <Segmented
              label="Agrupar por"
              value={group}
              options={groupsFor(period).map((g) => ({ value: g.value, label: g.label }))}
              onChange={(next) => select({ period, group: next })}
            />
          </>
        }
      />
      {!pending &&
        (analysis.isPending ? (
          <Skeleton className="h-24 rounded-panel" />
        ) : (
          <InsightBlock insight={insight} offer={offer} />
        ))}
      {body}
      {report && report.total > 0 && (
        <p className="sr-only" aria-live="polite">
          {`Faturamento de ${money(report.total)} nos últimos ${periodDays(period)} dias.`}
        </p>
      )}
    </div>
  )
}
