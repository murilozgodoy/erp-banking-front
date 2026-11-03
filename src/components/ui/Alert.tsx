import type { ReactNode } from 'react'

const tones = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-positive/30 bg-positive-soft text-positive',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  error: 'border-negative/30 bg-negative-soft text-negative',
}

interface AlertProps {
  tone?: keyof typeof tones
  title?: string
  children: ReactNode
}

export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}
