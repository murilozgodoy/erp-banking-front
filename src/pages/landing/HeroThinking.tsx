import { animate, m, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { FAISCA_PATH, MARK_FILL, MARK_LINES } from '@/components/brand/geometry'
import { cn } from '@/lib/cn'

import { CASHFLOW, CASHFLOW_ANTECIPADO, CHART, smoothPath, toX, toY } from './cashflow'
import { ease } from './styles'

/**
 * Roteiro em milissegundos. Uma coisa acontece por vez: cada etapa entra, a linha de progresso
 * dela se completa e vira check; a curva só se desenha na etapa da projeção; a conclusão entra
 * depois que o vale foi marcado. Depois ela fica parada (a pausa faz parte da leitura) e o
 * conteúdo some num crossfade para recomeçar, sem rebobinar.
 */
const CUE = {
  step0: 400,
  step0Done: 1600,
  step1: 1900,
  step1Done: 3100,
  step2: 3400,
  draw: 3500,
  step2Done: 4700,
  step3: 4900,
  step3Done: 5500,
  conclude: 6800,
  card: 6900,
  lift: 7200,
  fade: 12000,
  end: 12450,
} as const

type Cue = keyof typeof CUE

const CUE_TIMES = Object.values(CUE).sort((a, b) => a - b)

/** Último ponto do roteiro já alcançado em `t` (ou -1 antes do primeiro). */
function reachedAt(t: number) {
  let reached = -1
  for (const time of CUE_TIMES) if (time <= t) reached = time
  return reached
}

/** O estado final, mostrado parado quando o visitante pede menos movimento. */
const FINAL = CUE.lift

const STEP_DURATION = 1.2

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const thousands = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const VALE = CASHFLOW.find(([day]) => day === 18)?.[1] ?? 0
const VALE_ANTECIPADO = CASHFLOW_ANTECIPADO.find(([day]) => day === 18)?.[1] ?? 0

const zeroY = toY(0)
const LINE_D = smoothPath(CASHFLOW)
const LIFTED_D = smoothPath(CASHFLOW_ANTECIPADO)
const areaOf = (path: string) => `${path} L${CHART.width},${zeroY} L0,${zeroY} Z`
const dipX = toX(18)

export const HERO_THINKING_LABEL =
  'Demonstração da ErpIa lendo a operação da Padaria Trigo Bom: 2.980 vendas dos últimos 120 ' +
  'dias, 4.885 recebíveis e 55 contas a pagar. A projeção de caixa de 60 dias encontra um vale ' +
  'de R$ 31,8 mil no dia 18. Conclusão: antecipar R$ 42 mil de recebíveis cobre o vale, a 1,29% ' +
  'ao mês em 3 parcelas, com crédito pré-aprovado.'

/**
 * Painel "ErpIa pensando" do hero: a leitura da operação da padaria de exemplo como um trace ao
 * vivo, até a conclusão de crédito. É ilustração com significado: um único `role="img"` com o
 * resumo da história, sem nada focável dentro. Pausa com o ponteiro em cima e fora da tela; com
 * "reduzir movimento", mostra o estado concluído parado.
 */
export function HeroThinking({ className }: { className?: string }) {
  const still = useReducedMotion() === true
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.35 })
  const [hovered, setHovered] = useState(false)
  const [reached, setReached] = useState(-1)
  const [cycle, setCycle] = useState(0)
  const elapsed = useRef(0)

  const running = !still && inView && !hovered

  useEffect(() => {
    if (!running) return
    let frame = 0
    let last: number | null = null
    const tick = (now: number) => {
      // Limita o salto (aba em segundo plano, máquina lenta) para o roteiro não pular etapas.
      const delta = last === null ? 0 : Math.min(now - last, 100)
      last = now
      elapsed.current += delta
      if (elapsed.current >= CUE.end) {
        elapsed.current = 0
        setCycle((c) => c + 1)
      }
      const next = reachedAt(elapsed.current)
      setReached((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  const now = still ? FINAL : reached
  const at = (cue: Cue) => now >= CUE[cue]
  const thinking = !still && !at('conclude')

  return (
    <div
      ref={ref}
      role="img"
      aria-label={HERO_THINKING_LABEL}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        'overflow-hidden rounded-panel border border-line bg-rail text-ink surface-dark shadow-overlay select-none',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <ThinkingMark thinking={thinking} />
          <span className="relative grid text-sm font-medium">
            <Swap shown={!at('conclude') || at('fade')} still={still}>
              Lendo a operação
            </Swap>
            <Swap shown={at('conclude') && !at('fade')} still={still}>
              Leitura concluída
            </Swap>
          </span>
        </div>
        <span className="truncate text-xs text-ink-faint">Padaria Trigo Bom</span>
      </div>

      <m.div
        key={cycle}
        initial={still || cycle === 0 ? false : { opacity: 0 }}
        animate={{ opacity: at('fade') ? 0 : 1 }}
        transition={{ duration: 0.4, ease }}
      >
        <ol className="grid gap-2.5 px-4 pt-4 sm:px-5 sm:pt-5">
          <Step
            shown={at('step0')}
            done={at('step0Done')}
            still={still}
            label={
              <>
                Lendo <Count to={2980} run={at('step0')} still={still} format={integer} /> vendas
                dos últimos 120 dias
              </>
            }
          />
          <Step
            shown={at('step1')}
            done={at('step1Done')}
            still={still}
            label={
              <>
                Cruzando <Count to={4885} run={at('step1')} still={still} format={integer} />{' '}
                recebíveis com <Count to={55} run={at('step1')} still={still} format={integer} />{' '}
                contas a pagar
              </>
            }
          />
          <Step
            shown={at('step2')}
            done={at('step2Done')}
            still={still}
            label="Projetando o caixa dos próximos 60 dias"
          />
          <Step
            shown={at('step3')}
            done={at('step3Done')}
            duration={0.6}
            attention
            still={still}
            label={
              <>
                Encontrado: vale de{' '}
                <span className="text-warning">
                  R${' '}
                  <Count
                    to={Math.abs(VALE)}
                    run={at('step3')}
                    still={still}
                    format={thousands}
                    tone="text-warning"
                  />{' '}
                  mil
                </span>{' '}
                no dia 18
              </>
            }
          />
        </ol>

        <CashChart
          drawn={at('draw')}
          found={at('step3')}
          lifted={at('lift')}
          still={still}
          className="mx-4 mt-5 sm:mx-5"
        />

        <div className="p-4 pt-4 sm:p-5 sm:pt-4">
          <m.div
            initial={still ? false : { opacity: 0, y: 12 }}
            animate={at('card') ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.32, ease }}
            className="rounded-control border border-credit-line bg-credit-soft p-3.5 sm:p-4"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-credit-ink">
              <Faisca label={null} />
              Conclusão
            </p>
            <p className="mt-1.5 text-base font-medium text-ink">
              Antecipar R$ 42 mil cobre o vale
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="tabular text-sm text-ink-muted">1,29% a.m. · 3 parcelas</p>
              <span className="rounded-full bg-credit px-2 py-0.5 text-2xs font-medium text-rail">
                Pré-aprovado
              </span>
            </div>
          </m.div>
        </div>
      </m.div>
    </div>
  )
}

/** Símbolo da ErpIa em que só a Faísca se mexe: um quarto de volta lento enquanto lê. */
function ThinkingMark({ thinking }: { thinking: boolean }) {
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
function Swap({ shown, still, children }: { shown: boolean; still: boolean; children: string }) {
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

interface StepProps {
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
function Step({
  shown,
  done,
  still,
  label,
  duration = STEP_DURATION,
  attention = false,
}: StepProps) {
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

interface CountProps {
  to: number
  run: boolean
  still: boolean
  format: Intl.NumberFormat
  tone?: string
}

/** Número que conta rápido (≤ 600 ms) até o valor, em algarismos tabulares. */
function Count({ to, run, still, format, tone = 'text-ink' }: CountProps) {
  const value = useMotionValue(still ? to : 0)
  const text = useTransform(value, (v) => format.format(v))

  useEffect(() => {
    if (still || !run) return
    const controls = animate(value, to, { duration: 0.6, ease })
    return () => controls.stop()
  }, [still, run, to, value])

  // O valor final, invisível, reserva a largura: a frase não se mexe enquanto o número conta.
  return (
    <span className={cn('tabular inline-grid font-medium', tone)}>
      <span className="invisible col-start-1 row-start-1">{format.format(to)}</span>
      <m.span className="col-start-1 row-start-1 text-right">{text}</m.span>
    </span>
  )
}

interface CashChartProps {
  drawn: boolean
  found: boolean
  lifted: boolean
  still: boolean
  className?: string
}

/**
 * Caixa projetado de 60 dias: a curva se desenha, o trecho abaixo de zero e o dia 18 ficam
 * marcados e, na conclusão, a curva sobe para cima do zero (morph entre os dois caminhos).
 */
function CashChart({ drawn, found, lifted, still, className }: CashChartProps) {
  const from = still ? false : undefined
  const markerTone = lifted ? 'fill-accent' : 'fill-negative'
  return (
    <div className={className}>
      <p className="text-xs text-ink-muted">Caixa projetado, próximos 60 dias</p>
      <div className="relative mt-2 aspect-[10/3]">
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="absolute inset-0 size-full">
          <defs>
            <clipPath id="hero-thinking-below-zero">
              <rect x="0" y={zeroY} width={CHART.width} height={CHART.height - zeroY} />
            </clipPath>
          </defs>
          <m.path
            className="fill-negative-soft"
            clipPath="url(#hero-thinking-below-zero)"
            initial={from ?? { opacity: 0, d: areaOf(LINE_D) }}
            animate={{ opacity: found ? 1 : 0, d: areaOf(lifted ? LIFTED_D : LINE_D) }}
            transition={{ opacity: { duration: 0.32, ease }, d: { duration: 0.7, ease } }}
          />
          <line
            x1="0"
            x2={CHART.width}
            y1={zeroY}
            y2={zeroY}
            className="stroke-line-strong"
            strokeDasharray="4 5"
            vectorEffect="non-scaling-stroke"
          />
          <m.line
            x1={dipX}
            x2={dipX}
            y1="0"
            y2={CHART.height}
            className="stroke-line-strong"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
            initial={from ?? { opacity: 0 }}
            animate={{ opacity: found ? 1 : 0 }}
            transition={{ duration: 0.32, ease }}
          />
          <m.path
            fill="none"
            strokeWidth={2.25}
            strokeLinecap="round"
            className={cn(
              'transition-[stroke] duration-300 ease-out-expo',
              lifted ? 'stroke-accent' : 'stroke-ink-muted',
            )}
            initial={from ?? { pathLength: 0, opacity: 0, d: LINE_D }}
            animate={{
              pathLength: drawn ? 1 : 0,
              opacity: drawn ? 1 : 0,
              d: lifted ? LIFTED_D : LINE_D,
            }}
            transition={{
              pathLength: { duration: 1.2, ease },
              opacity: { duration: 0.12 },
              d: { duration: 0.7, ease },
            }}
          />
          <m.circle
            cx={dipX}
            r={5}
            strokeWidth={3}
            className={cn('stroke-rail transition-[fill] duration-300 ease-out-expo', markerTone)}
            initial={from ?? { opacity: 0, cy: toY(VALE) }}
            animate={{ opacity: found ? 1 : 0, cy: toY(lifted ? VALE_ANTECIPADO : VALE) }}
            transition={{ opacity: { duration: 0.24, ease }, cy: { duration: 0.7, ease } }}
          />
        </svg>
      </div>
      <div className="relative mt-1.5 h-4 text-2xs text-ink-faint">
        <span className="absolute left-0">hoje</span>
        <span
          className={cn(
            'absolute -translate-x-1/2 transition-colors duration-300 ease-out-expo',
            found && !lifted && 'text-negative',
          )}
          style={{ left: `${(dipX / CHART.width) * 100}%` }}
        >
          dia 18
        </span>
        <span className="absolute right-0">dia 60</span>
      </div>
    </div>
  )
}
