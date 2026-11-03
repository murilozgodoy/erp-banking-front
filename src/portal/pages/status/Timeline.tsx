import { motion, useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type StepState = 'done' | 'current' | 'pending' | 'failed'

export interface TimelineStep {
  id: string
  title: string
  detail?: ReactNode
  state: StepState
}

const STATE_LABEL: Record<StepState, string> = {
  done: 'concluída',
  current: 'em andamento',
  pending: 'a seguir',
  failed: 'não aprovada',
}

const EASE = [0.16, 1, 0.3, 1] as const

function Marker({ state }: { state: StepState }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      // Remonta a cada troca de estado: o marcador "assenta" em 200 ms e comunica a mudança.
      key={state}
      aria-hidden
      initial={reduce ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn(
        'relative z-10 grid size-6 shrink-0 place-items-center rounded-full',
        state === 'done' && 'bg-accent text-on-accent',
        state === 'failed' && 'bg-negative text-white dark:text-paper',
        state === 'current' && 'border-2 border-accent bg-surface',
        state === 'pending' && 'border-2 border-line-strong bg-surface',
      )}
    >
      {state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
      {state === 'failed' && <X className="size-3.5" strokeWidth={3} />}
      {state === 'current' && (
        <motion.span
          className="size-2 rounded-full bg-accent"
          // Respiração lenta só no passo em andamento: diz "está rodando" sem fingir progresso.
          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
          transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.span>
  )
}

/** Linha do tempo vertical da análise: o que já aconteceu, o que está rodando e o que vem. */
export function Timeline({ steps, label }: { steps: TimelineStep[]; label: string }) {
  return (
    <ol aria-label={label} className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        return (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-6 bottom-0 left-[11px] w-0.5 transition-colors duration-200',
                  step.state === 'done' ? 'bg-accent' : 'bg-line',
                )}
              />
            )}
            <Marker state={step.state} />
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.state === 'pending' ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {step.title}
                <span className="sr-only">: {STATE_LABEL[step.state]}</span>
              </p>
              {step.detail && <p className="mt-0.5 text-sm text-ink-muted">{step.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
