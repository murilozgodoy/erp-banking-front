import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, description, actions, children }: CardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
