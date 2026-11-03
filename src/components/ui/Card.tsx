import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, description, actions, children }: CardProps) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-ink">{title}</h2>}
            {description && <p className="text-sm text-ink-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
