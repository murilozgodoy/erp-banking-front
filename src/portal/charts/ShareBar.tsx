import { cn } from '@/lib/cn'
import { money, pct } from '../lib/format'

export interface Share {
  key: string
  label: string
  value: number
  /** Em pontos percentuais (0–100). */
  pct: number
}

const SERIES = [1, 2, 3, 4, 5].map((n) => `var(--color-series-${n})`)

/**
 * Composição em uma barra horizontal (no lugar de pizza/donut), com 2 px de respiro entre os
 * segmentos e legenda com valor e % — a identidade nunca depende só da cor. Mais de 5 partes
 * viram "Outros".
 */
export function ShareBar({
  title,
  shares,
  className,
}: {
  title: string
  shares: Share[]
  className?: string
}) {
  const sorted = [...shares].sort((a, b) => b.value - a.value)
  const visible =
    sorted.length > 5
      ? [
          ...sorted.slice(0, 4),
          sorted
            .slice(4)
            .reduce((acc, s) => ({ ...acc, value: acc.value + s.value, pct: acc.pct + s.pct }), {
              key: 'outros',
              label: 'Outros',
              value: 0,
              pct: 0,
            }),
        ]
      : sorted
  return (
    <figure className={cn('space-y-3', className)}>
      <div
        role="img"
        aria-label={title}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {visible.map((share, i) => (
          <span
            key={share.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max(share.pct, 0.5)}%`, background: SERIES[i] }}
          />
        ))}
      </div>
      <figcaption>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {visible.map((share, i) => (
            <li key={share.key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: SERIES[i] }}
                />
                <span className="truncate">{share.label}</span>
              </span>
              <span className="tabular shrink-0 text-ink-muted">
                <span className="font-medium text-ink">{pct(share.pct, 0)}</span> ·{' '}
                {money(share.value, { compact: true })}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
