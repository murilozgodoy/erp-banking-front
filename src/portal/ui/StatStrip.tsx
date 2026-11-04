import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Skeleton } from './Surface'

export interface Stat {
  label: string
  value: ReactNode
  /** Linha de apoio: variação, benchmark, contexto. */
  detail?: ReactNode
}

/**
 * Faixa densa de indicadores separados por divisores (não uma grade de cards iguais).
 * Os números usam tabular-nums e alinham pela base.
 */
export function StatStrip({
  stats,
  loading = false,
  columns = 'auto',
  className,
}: {
  stats: Stat[]
  loading?: boolean
  /** `three`: no máximo 3 colunas (2 × 3 no tablet, 3 × 2 no desktop), para colunas estreitas. */
  columns?: 'auto' | 'three'
  className?: string
}) {
  return (
    <dl
      aria-busy={loading || undefined}
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-surface shadow-raised sm:grid-cols-3',
        columns === 'auto' && stats.length >= 4 && 'lg:grid-cols-4',
        columns === 'auto' && stats.length >= 6 && 'xl:grid-cols-6',
        columns === 'three' && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="-mt-px -ml-px flex min-w-0 flex-col gap-1 border-t border-l border-line px-3.5 py-3.5 sm:px-4"
        >
          <dt className="text-xs font-medium text-pretty text-ink-muted">{stat.label}</dt>
          <dd className="tabular text-lg font-semibold text-ink sm:text-xl">
            {loading ? <Skeleton className="mt-1 h-5 w-24" /> : stat.value}
          </dd>
          {stat.detail && !loading && (
            <dd className="tabular text-xs text-ink-muted">{stat.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  )
}
