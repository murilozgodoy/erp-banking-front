import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'credit'

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  credit: 'bg-credit-soft text-credit-ink',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  accent: 'bg-accent',
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
  info: 'bg-info',
  credit: 'bg-credit',
}

/** Rótulo de status: ponto + texto, nunca só a cor. */
export function Pill({
  tone = 'neutral',
  children,
  dot = true,
  className,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}
