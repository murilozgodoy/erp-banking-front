import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

import { money, number, pct } from '../../lib/format'
import { Delta } from '../../ui/Delta'
import { Skeleton } from '../../ui/Surface'
import type { BusinessAnalysis, KpiId, Overview } from '../../types'

interface Item {
  label: string
  value: ReactNode
  note?: ReactNode
}

function kpi(analysis: BusinessAnalysis | undefined, id: KpiId) {
  return analysis?.kpis.find((k) => k.id === id)
}

function dias(valor: number): string {
  return `${number(valor)} ${Math.abs(valor) === 1 ? 'dia' : 'dias'}`
}

/** Os 4 indicadores principais: receita, margem, prazo de recebimento e ciclo de caixa. */
function primary(o: Overview, analysis: BusinessAnalysis | undefined, pending: boolean): Item[] {
  const waiting = pending ? <Skeleton className="mt-1 h-6 w-20" /> : '—'
  const margem = kpi(analysis, 'margem_bruta_pct')
  const prazo = kpi(analysis, 'prazo_medio_recebimento_dias')
  const ciclo = kpi(analysis, 'ciclo_caixa_dias')
  const prazoDiff =
    prazo && prazo.benchmark_segmento !== null ? prazo.valor - prazo.benchmark_segmento : null
  return [
    {
      label: 'Receita 30 dias',
      value: money(o.receita_30d),
      note:
        o.receita_30d_variacao_pct === null ? (
          'sem base de comparação'
        ) : (
          <Delta value={o.receita_30d_variacao_pct} context="no mês" />
        ),
    },
    {
      label: 'Margem estimada',
      value: margem ? pct(margem.valor, 1) : waiting,
      note:
        margem?.benchmark_segmento != null
          ? `segmento: ${pct(margem.benchmark_segmento, 1)}`
          : margem?.leitura,
    },
    {
      label: 'Prazo médio de recebimento',
      value: prazo ? dias(prazo.valor) : waiting,
      note:
        prazoDiff === null ? (
          prazo?.leitura
        ) : prazoDiff === 0 ? (
          'igual ao segmento'
        ) : (
          <span className={prazoDiff > 0 ? 'text-negative' : 'text-positive'}>
            {prazoDiff > 0 ? '+' : '−'}
            {dias(Math.abs(prazoDiff))} vs. segmento
          </span>
        ),
    },
    {
      label: 'Ciclo de caixa',
      value: ciclo ? dias(ciclo.valor) : waiting,
      note:
        ciclo?.benchmark_segmento != null
          ? `meta: ${dias(ciclo.benchmark_segmento)}`
          : ciclo?.leitura,
    },
  ]
}

function SecondaryLink({ to, children }: { to: string; children: ReactNode }) {
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

/** Indicadores operacionais, numa linha menor abaixo dos principais. */
function secondary(o: Overview): Item[] {
  const atrasado = o.atrasados_total > 0
  return [
    {
      label: 'Recebíveis 90 dias',
      value: money(o.recebiveis_90d),
      note: <SecondaryLink to="/app/recebiveis">Ver agenda</SecondaryLink>,
    },
    {
      label: 'A pagar 30 dias',
      value: money(o.a_pagar_30d),
      note: <SecondaryLink to="/app/pagamentos">Ver contas</SecondaryLink>,
    },
    {
      label: 'Em atraso',
      value: (
        <span className={atrasado ? 'text-negative' : undefined}>{money(o.atrasados_total)}</span>
      ),
      note: atrasado ? (
        <SecondaryLink to="/app/pendencias">Resolver</SecondaryLink>
      ) : (
        'nenhuma conta em atraso'
      ),
    },
    {
      label: 'Estoque',
      value: money(o.estoque_valor),
      note: <SecondaryLink to="/app/estoque">a preço de custo</SecondaryLink>,
    },
  ]
}

function Cell({ item, size }: { item: Item; size: 'lg' | 'sm' }) {
  return (
    <div className={cn('min-w-0 bg-surface', size === 'lg' ? 'px-4 py-3.5' : 'px-4 py-2.5')}>
      <dt className="truncate text-xs text-ink-muted">{item.label}</dt>
      <dd
        className={cn(
          'tabular font-semibold text-ink',
          size === 'lg' ? 'mt-1 text-xl' : 'mt-0.5 text-base',
        )}
      >
        {item.value}
      </dd>
      {item.note && <dd className="mt-0.5 truncate text-xs text-ink-muted">{item.note}</dd>}
    </div>
  )
}

/**
 * Faixa de indicadores no topo da Visão geral: os 4 principais em destaque (2 × 2 no mobile) e
 * os operacionais numa linha menor, com atalho para a área de cada um.
 */
export function KpiBand({
  overview,
  analysis,
  analysisPending,
}: {
  overview: Overview
  analysis: BusinessAnalysis | undefined
  analysisPending: boolean
}) {
  return (
    <section
      aria-label="Indicadores da empresa"
      className="overflow-hidden rounded-panel border border-line bg-line shadow-raised"
    >
      <dl className="grid grid-cols-2 gap-px lg:grid-cols-4">
        {primary(overview, analysis, analysisPending).map((item) => (
          <Cell key={item.label} item={item} size="lg" />
        ))}
      </dl>
      <dl className="mt-px grid grid-cols-2 gap-px lg:grid-cols-4">
        {secondary(overview).map((item) => (
          <Cell key={item.label} item={item} size="sm" />
        ))}
      </dl>
    </section>
  )
}
