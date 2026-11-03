import type { ReactNode } from 'react'

const tones = {
  neutral: 'bg-sunken text-ink',
  success: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-negative-soft text-negative',
  info: 'bg-accent-soft text-accent',
}

export type BadgeTone = keyof typeof tones

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
