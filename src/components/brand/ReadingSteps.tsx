import { m } from 'motion/react'
import type { ReactNode } from 'react'

import { FAISCA_PATH, MARK_FILL, MARK_LINES } from './geometry'

/**
 * Peças do "card de leitura" da ErpIa (o trace do hero da landing, reusado no assistente do
 * portal): o símbolo em que só a Faísca gira, o texto que troca no lugar e a etapa com linha de
 * progresso que vira check. Usam `m` (LazyMotion): envolva com `<LazyMotion features={domAnimation}>`.
 */

const ease = [0.16, 1, 0.3, 1] as const

/** Tempo (s) padrão da linha de progresso de uma etapa. */
export const STEP_DURATION = 1.2

/** Símbolo da ErpIa em que só a Faísca se mexe: um quarto de volta lento enquanto lê. */
export function ReadingMark({ thinking }: { thinking: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="size-6 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" fill={MARK_FILL.dark} />
      {MARK_LINES.map((bar) => (
        <rect key={bar.y} x="8" y={bar.y} width={bar.width} height="3" rx="1.5" fill="#EEF2EC" />
      ))}
      <m.path
        d={FAISCA_PATH}
        fill="#C6F24E"
        initial={false}
        animate={thinking ? { rotate: [0, 90], scale: [1, 0.78, 1] } : { rotate: 0, scale: 1 }}
        transition={
          thinking
            ? { duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.5 }
            : { duration: 0.3, ease }
        }
      />
    </svg>
  )
}

/** Texto que troca no mesmo lugar (crossfade com 6 px de deslocamento). */
export function ReadingSwap({
  shown,
  still,
  children,
}: {
  shown: boolean
  still: boolean
  children: string
}) {
  return (
    <m.span
      className="col-start-1 row-start-1 whitespace-nowrap"
      initial={false}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: still ? 0 : -6 }}
      transition={{ duration: 0.28, ease }}
    >
      {children}
    </m.span>
  )
}

export interface ReadingStepProps {
  shown: boolean
  done: boolean
  still: boolean
  label: ReactNode
  /** Tempo (s) da linha de progresso até a etapa concluir. */
  duration?: number
  /** Etapa que encontrou algo que pede atenção: termina com "!" em vez de check. */
  attention?: boolean
}

/**
 * Uma linha do trace: o texto sobe de trás de uma máscara; o status é uma linha fina que se
 * completa no tempo da etapa e vira um check (ou um sinal de atenção) desenhado.
 */
export function ReadingStep({
  shown,
  done,
  still,
  label,
  duration = STEP_DURATION,
  attention = false,
}: ReadingStepProps) {
  const from = still ? false : undefined
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2.5">
      <svg
        viewBox="0 0 16 16"
        className="mt-[0.1875rem] size-4"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <m.g
          initial={from ?? { opacity: 0 }}
          animate={{ opacity: shown && !done ? 1 : 0 }}
          transition={{ duration: 0.18, ease }}
        >
          <path d="M2.5 8h11" className="stroke-line-strong" />
          <m.path
            d="M2.5 8h11"
            className="stroke-ink-muted"
            initial={from ?? { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
            transition={{
              pathLength: { duration: shown ? duration : 0, ease: 'linear' },
              opacity: { duration: 0.18 },
            }}
          />
        </m.g>
        {attention ? (
          <g className="stroke-warning">
            <m.path
              d="M8 3v6.25"
              initial={from ?? { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
              transition={{ duration: 0.24, ease }}
            />
            <m.circle
              cx="8"
              cy="12.6"
              r="0.6"
              className="fill-warning"
              initial={from ?? { opacity: 0 }}
              animate={{ opacity: done ? 1 : 0 }}
              transition={{ duration: 0.18, ease, delay: done && !still ? 0.18 : 0 }}
            />
          </g>
        ) : (
          <m.path
            d="M3.25 8.4 6.4 11.5l6.35-7"
            className="stroke-accent"
            initial={from ?? { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: 0.28, ease }}
          />
        )}
      </svg>
      <span className="block overflow-hidden">
        <m.span
          className="block text-sm text-ink-muted"
          initial={from ?? { opacity: 0, y: 8 }}
          animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease }}
        >
          {label}
        </m.span>
      </span>
    </li>
  )
}
