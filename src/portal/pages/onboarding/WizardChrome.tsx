import { AlertTriangle, Check, CloudOff, LoaderCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Ref } from 'react'

import { cn } from '@/lib/cn'

import { STEPS } from './model'
import type { SaveStatus } from './useAutosave'

interface StepProgressProps {
  current: number
  /** Maior passo já alcançado: dá para voltar a qualquer um até ele. */
  reachable: number
  completed: boolean[]
  onGo: (step: number) => void
}

/** Progresso do wizard: lista vertical no desktop, barra compacta no celular. */
export function StepProgress({ current, reachable, completed, onGo }: StepProgressProps) {
  const reduce = useReducedMotion()
  return (
    <nav aria-label="Progresso do cadastro">
      <div className="lg:hidden">
        <p className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink">{STEPS[current].nome}</span>
          <span className="tabular text-ink-muted">
            Passo {current + 1} de {STEPS.length}
          </span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
          {STEPS.map((step, index) => (
            <span key={step.id} className="relative h-1 overflow-hidden rounded-full bg-sunken">
              {index <= current && (
                <motion.span
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 origin-left rounded-full bg-accent"
                />
              )}
            </span>
          ))}
        </div>
      </div>

      <ol className="hidden lg:block">
        {STEPS.map((step, index) => {
          const isCurrent = index === current
          const done = completed[index] && index < reachable && !isCurrent
          const canGo = index <= reachable && !isCurrent
          const content = (
            <>
              <span
                className={cn(
                  'tabular relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors duration-200',
                  isCurrent && 'border-accent bg-accent text-on-accent',
                  done && 'border-accent bg-accent-soft text-accent',
                  !isCurrent && !done && 'border-line-strong bg-surface text-ink-muted',
                )}
              >
                {done ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="min-w-0 pt-1">
                <span
                  className={cn(
                    'block text-sm',
                    isCurrent ? 'font-semibold text-ink' : 'font-medium text-ink-muted',
                  )}
                >
                  {step.nome}
                </span>
                {done && <span className="sr-only"> (concluído)</span>}
              </span>
            </>
          )
          return (
            <li key={step.id} className="relative pb-6 last:pb-0">
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-8 bottom-1 left-3.5 w-px',
                    index < current ? 'bg-accent/40' : 'bg-line',
                  )}
                />
              )}
              {canGo ? (
                <button
                  type="button"
                  onClick={() => onGo(index)}
                  className="-m-1 flex w-full items-start gap-3 rounded-control p-1 text-left hover:[&>span:last-child>span:first-child]:text-ink"
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex items-start gap-3"
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface SaveIndicatorProps {
  status: SaveStatus
  onRetry: () => void
}

/** Estado do rascunho, discreto: só chama atenção quando falha. */
export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  return (
    <div role="status" className="min-h-5 text-xs text-ink-muted">
      {(status === 'pending' || status === 'saving') && (
        <span className="inline-flex items-center gap-1.5">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
          Salvando…
        </span>
      )}
      {status === 'saved' && (
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden className="size-3.5 text-positive" />
          Salvo há instantes
        </span>
      )}
      {status === 'error' && (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 text-negative">
          <CloudOff aria-hidden className="size-3.5" />
          Não foi possível salvar —
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline underline-offset-2 hover:text-ink"
          >
            tentar de novo
          </button>
        </span>
      )}
    </div>
  )
}

interface ErrorSummaryProps {
  items: { key: string; label: string; erro: string; passo: string }[]
  onGo: (key: string) => void
  ref?: Ref<HTMLDivElement>
}

/** Resumo dos erros do envio: cada item leva ao campo. */
export function ErrorSummary({ items, onGo, ref }: ErrorSummaryProps) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="erros-envio-titulo"
      className="rounded-panel border border-negative/25 bg-negative-soft p-4 outline-none focus-visible:ring-3 focus-visible:ring-negative/30"
    >
      <p id="erros-envio-titulo" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <AlertTriangle aria-hidden className="size-4 text-negative" />
        {items.length === 1
          ? 'Revise 1 campo antes de enviar'
          : `Revise ${items.length} campos antes de enviar`}
      </p>
      <ul className="mt-2 space-y-1 pl-6 text-sm">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onGo(item.key)}
              className="text-left text-ink underline decoration-negative/40 underline-offset-2 hover:decoration-negative"
            >
              <span className="text-ink-muted">{item.passo} · </span>
              {item.label}: {item.erro}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
