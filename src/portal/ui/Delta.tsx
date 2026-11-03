import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/cn'
import { signedPct } from '../lib/format'

interface DeltaProps {
  /** Variação em pontos percentuais. */
  value: number
  /** Quando subir é ruim (ex.: inadimplência, prazo de recebimento). */
  inverse?: boolean
  /** Texto de comparação, ex.: "vs. 30 dias anteriores". */
  context?: string
  className?: string
}

/** Variação com seta + sinal + cor: a cor nunca é o único portador do significado. */
export function Delta({ value, inverse = false, context, className }: DeltaProps) {
  const good = inverse ? value < 0 : value > 0
  const flat = Math.abs(value) < 0.05
  const Icon = flat ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight
  const tone = flat
    ? 'text-ink-muted bg-sunken'
    : good
      ? 'text-positive bg-positive-soft'
      : 'text-negative bg-negative-soft'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span
        className={cn(
          'tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
          tone,
        )}
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
        {signedPct(value)}
      </span>
      {context && <span className="text-ink-muted">{context}</span>}
    </span>
  )
}
