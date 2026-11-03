import { AlertTriangle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Button } from './Button'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

/** Título da página: sem eyebrow; o título carrega o peso sozinho. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-6">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="max-w-[68ch] text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

interface PanelProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Sem padding interno (tabelas encostadas na borda). */
  flush?: boolean
  /** id do título, para `aria-labelledby` de regiões. */
  id?: string
}

/** Bloco de trabalho da página. Não aninhe painéis: dentro deles use divisores. */
export function Panel({ title, description, actions, children, className, flush, id }: PanelProps) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn('rounded-panel border border-line bg-surface shadow-raised', className)}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-base font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : cn('px-5 pb-5', !(title || actions) && 'pt-5')}>
        {children}
      </div>
    </section>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block skeleton', className)} />
}

/** Esqueleto de um painel inteiro, com o rótulo para leitores de tela. */
export function PanelSkeleton({
  rows = 4,
  label = 'Carregando…',
}: {
  rows?: number
  label?: string
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="rounded-panel border border-line bg-surface p-5 shadow-raised"
    >
      <Skeleton className="mb-5 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn('h-3.5', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

/** Estado vazio que ensina: o que é a área e o que fazer para preenchê-la. */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-sunken text-ink-muted">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-[52ch] text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  /** O problema e o que fazer, na linguagem do cliente. */
  message: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Não conseguimos carregar esta área',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-panel border border-negative/25 bg-negative-soft p-5 sm:flex-row sm:items-center"
    >
      <AlertTriangle aria-hidden className="size-5 shrink-0 text-negative" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCw className="size-4" />}
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
