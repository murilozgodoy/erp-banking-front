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
  className,
}: {
  stats: Stat[]
  loading?: boolean
  className?: string
}) {
  return (
    <dl
      aria-busy={loading || undefined}
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-surface shadow-raised sm:grid-cols-3',
        stats.length >= 4 && 'lg:grid-cols-4',
        stats.length >= 6 && 'xl:grid-cols-6',
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="-mt-px -ml-px flex min-w-0 flex-col gap-1 border-t border-l border-line px-4 py-3.5"
        >
          <dt className="truncate text-xs font-medium text-ink-muted">{stat.label}</dt>
          <dd className="tabular text-lg font-semibold text-ink">
            {loading ? <Skeleton className="mt-1 h-5 w-24" /> : stat.value}
          </dd>
          {stat.detail && !loading && <dd className="text-xs text-ink-muted">{stat.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}
