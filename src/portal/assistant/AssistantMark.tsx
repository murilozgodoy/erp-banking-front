import { motion, useReducedMotion } from 'motion/react'

import { FAISCA_CENTER, FAISCA_PATH } from '@/components/brand/geometry'
import { cn } from '@/lib/cn'

export type AssistantMarkState = 'idle' | 'thinking' | 'done'

const EASE = [0.16, 1, 0.3, 1] as const
const C = 24

/** Arco do círculo de raio `r` entre os ângulos `from` e `to` (graus, 0 = topo). */
function arc(r: number, from: number, to: number) {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return `${(C + r * Math.cos(rad)).toFixed(2)} ${(C + r * Math.sin(rad)).toFixed(2)}`
  }
  return `M${point(from)} A${r} ${r} 0 0 1 ${point(to)}`
}

/**
 * As três linhas de razão contábil do símbolo, curvadas em volta da Faísca. A do meio é a curta,
 * como no "E" do símbolo.
 */
const LEDGER = [arc(19, -20, 50), arc(19, 100, 128), arc(19, 220, 290)]

/** A Faísca da marca, centrada no viewBox 48×48. */
const STAR_TRANSFORM = `translate(${C} ${C}) scale(2.3) translate(${-FAISCA_CENTER.x} ${-FAISCA_CENTER.y})`

/**
 * Símbolo da IA no assistente: a Faísca (lima) com as linhas de razão em volta.
 * `idle`: a Faísca respira e as linhas orbitam devagar; `thinking`: as linhas giram em volta da
 * estrela; `done`: as linhas se recolhem na estrela e um check se desenha. Com movimento reduzido,
 * é estático.
 */
export function AssistantMark({
  state = 'idle',
  size = 80,
  className,
}: {
  state?: AssistantMarkState
  size?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const still = !!reduce

  const orbit = still
    ? { rotate: 0 }
    : state === 'thinking'
      ? { rotate: 360 }
      : state === 'idle'
        ? { rotate: 360 }
        : { rotate: 0 }
  const orbitTransition =
    still || state === 'done'
      ? { duration: 0.3, ease: EASE }
      : { duration: state === 'thinking' ? 2.4 : 28, ease: 'linear' as const, repeat: Infinity }

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      data-state={state}
      data-still={still || undefined}
      data-testid="assistant-mark"
      className={cn('shrink-0 overflow-visible', className)}
      fill="none"
      strokeLinecap="round"
    >
      <motion.g
        style={{ originX: '50%', originY: '50%' }}
        initial={false}
        animate={
          state === 'done' && !still
            ? { ...orbit, scale: 0.35, opacity: 0 }
            : { ...orbit, scale: 1, opacity: 1 }
        }
        transition={orbitTransition}
      >
        {LEDGER.map((d, index) => (
          <motion.path
            key={d}
            d={d}
            strokeWidth={2.6}
            className="stroke-ink-muted"
            initial={false}
            animate={
              state === 'thinking' && !still
                ? { pathLength: [0.35, 1, 0.35], opacity: [0.55, 1, 0.55] }
                : { pathLength: 1, opacity: index === 1 ? 0.7 : 1 }
            }
            transition={
              state === 'thinking' && !still
                ? { duration: 1.6, ease: 'easeInOut', repeat: Infinity, delay: index * 0.2 }
                : { duration: 0.3, ease: EASE }
            }
          />
        ))}
      </motion.g>

      <motion.g
        style={{ originX: '50%', originY: '50%' }}
        initial={false}
        animate={
          still
            ? { scale: 1, rotate: 0 }
            : state === 'idle'
              ? { scale: [1, 1.04, 1], rotate: [0, 6, 0] }
              : state === 'thinking'
                ? { scale: [1, 0.86, 1], rotate: [0, 90] }
                : { scale: 1, rotate: 0 }
        }
        transition={
          still || state === 'done'
            ? { duration: 0.3, ease: EASE }
            : state === 'idle'
              ? { duration: 5, ease: 'easeInOut', repeat: Infinity }
              : { duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.3 }
        }
      >
        <path
          d={FAISCA_PATH}
          transform={STAR_TRANSFORM}
          className="fill-credit stroke-credit-ink/40 dark:stroke-transparent"
          strokeWidth={0.2}
        />
      </motion.g>

      {state === 'done' && (
        <motion.path
          d="M31 34.5l3.2 3.2 6.3-7"
          strokeWidth={2.6}
          strokeLinejoin="round"
          className="stroke-accent"
          data-testid="assistant-mark-check"
          initial={still ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.15 }}
        />
      )}
    </svg>
  )
}
