import { animate, m, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { ErpIaMark, Faisca, Marca } from '@/components/brand/Logo'

import { CASHFLOW, CASHFLOW_ANTECIPADO, CHART, smoothPath, toX, toY } from './cashflow'
import { ease } from './styles'

const NAV = [
  'Visão geral',
  'Vendas',
  'Recebíveis',
  'Pagamentos',
  'Pendências',
  'Estoque',
  'Crédito',
]

const reais = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const dias = (v: number) => `${Math.round(v)} dias`
const porcento = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const KPIS = [
  {
    label: 'Receita 30 dias',
    to: 184320,
    format: reais,
    note: '+8,2% no mês',
    tone: 'text-positive',
  },
  {
    label: 'Margem estimada',
    to: 23.4,
    format: porcento,
    note: 'faixa do segmento',
    tone: 'text-ink-faint',
  },
  {
    label: 'Prazo médio de recebimento',
    to: 34,
    format: dias,
    note: '+6 dias',
    tone: 'text-negative',
  },
  { label: 'Ciclo de caixa', to: 41, format: dias, note: 'meta: 30 dias', tone: 'text-ink-faint' },
]

/** Valores do caixa (em mil reais) que a miniatura cita, tirados de `cashflow.ts`. */
const valorNoDia = (series: [number, number][], day: number) =>
  series.find(([d]) => d === day)?.[1] ?? 0
const DIP_DAY = 18
const DIP_VALUE = valorNoDia(CASHFLOW, DIP_DAY)
const DIP_DEPOIS = valorNoDia(CASHFLOW_ANTECIPADO, DIP_DAY)
const SALDO_HOJE = valorNoDia(CASHFLOW, 0)

const line = smoothPath(CASHFLOW)
const area = `${line} L${CHART.width},${toY(0)} L0,${toY(0)} Z`
const zeroY = toY(0)
const pct = (day: number, value: number) => ({
  x: (toX(day) / CHART.width) * 100,
  y: (toY(value) / CHART.height) * 100,
})
const dip = pct(DIP_DAY, DIP_VALUE)

/** "3 de novembro" é o dia 0 do fluxo projetado. */
const dataDoDia = (day: number) =>
  new Date(2026, 10, 3 + day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** "−R$ 31,8 mil" (sinal de menos tipográfico, uma casa decimal). */
function milReais(value: number, sinal = false) {
  const abs = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const prefixo = value < 0 ? '−' : sinal ? '+' : ''
  return `${prefixo}R$ ${abs} mil`
}

/**
 * Valor da curva desenhada no dia `day`: a mesma Catmull-Rom de `smoothPath`, resolvida em
 * dias e milhares de reais (x cresce em cada trecho, então a bissecção acha o `t`).
 */
function saldoProjetado(day: number) {
  const last = CASHFLOW.length - 2
  const found = CASHFLOW.findIndex((_, k) => k <= last && day <= CASHFLOW[k + 1][0])
  const i = found === -1 ? last : found
  const p0 = CASHFLOW[i - 1] ?? CASHFLOW[i]
  const p1 = CASHFLOW[i]
  const p2 = CASHFLOW[i + 1]
  const p3 = CASHFLOW[i + 2] ?? p2
  const bez = (a: number, b: number, c: number, d: number, t: number) => {
    const u = 1 - t
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
  }
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
  let lo = 0
  let hi = 1
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2
    if (bez(p1[0], c1[0], c2[0], p2[0], mid) < day) lo = mid
    else hi = mid
  }
  // A suavização passa 0,1 mil abaixo do vale perto do dia 19; o mínimo citado é o do dia 18.
  return Math.max(DIP_VALUE, bez(p1[1], c1[1], c2[1], p2[1], (lo + hi) / 2))
}

/**
 * Coreografia de entrada (segundos, a partir de quando o painel entra na tela), 1,5 s no total:
 * os KPIs contam até o valor, a curva é revelada da esquerda para a direita, o vale aparece
 * quando a revelação passa por ele e, por último, o cartão de crédito sobe.
 */
const T = {
  kpiStagger: 0.07,
  kpiDuration: 0.9,
  curve: 0.15,
  curveDuration: 1,
  dip: 0.5,
  card: 1.05,
  cardDuration: 0.45,
} as const

function CountUp({
  to,
  format,
  delay,
  run,
}: {
  to: number
  format: (v: number) => string
  delay: number
  run: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || !run || reduce) return
    const controls = animate(0, to, {
      duration: T.kpiDuration,
      delay,
      ease,
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [run, reduce, to, format, delay])
  return <span ref={ref}>{format(reduce ? to : 0)}</span>
}

function ChartCursor({ day }: { day: number }) {
  const value = saldoProjetado(day)
  const p = pct(day, value)
  const alignRight = p.x > 62
  return (
    <>
      <span
        className="pointer-events-none absolute inset-y-0 w-px bg-line-strong"
        style={{ left: `${p.x}%` }}
      />
      <span
        className="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full border-2 border-surface bg-accent"
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
      />
      <span
        data-testid="chart-tooltip"
        className={`tabular pointer-events-none absolute top-0 rounded-control border border-line bg-surface px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-raised sm:text-xs ${
          alignRight ? '-ml-2 -translate-x-full' : 'ml-2'
        }`}
        style={{ left: `${p.x}%` }}
      >
        <span className="block text-ink-faint">
          {dataDoDia(day)} · {day === 0 ? 'hoje' : `em ${day} dias`}
        </span>
        <span className={`block font-medium ${value < 0 ? 'text-negative' : 'text-ink'}`}>
          {milReais(value)}
        </span>
      </span>
    </>
  )
}

const row = 'flex items-baseline justify-between gap-3 border-t border-credit-line py-1.5'

/**
 * Miniatura do portal (Visão geral) feita em HTML/CSS: KPIs, fluxo de caixa projetado e a
 * oportunidade de crédito marcada com a Faísca. É ilustração: fica fora da árvore acessível e
 * a legenda descreve o que ela mostra. No gráfico, um cursor mostra o saldo projetado do dia;
 * passar pelo cartão de crédito destaca o vale que ele cobre.
 */
export function DashboardPreview() {
  const frame = useRef<HTMLDivElement>(null)
  const inView = useInView(frame, { once: true, amount: 0.35 })
  const [day, setDay] = useState<number | null>(null)
  const [cardHover, setCardHover] = useState(false)
  const shown = inView ? 'shown' : 'hidden'

  function track(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    setDay(Math.round(ratio * CHART.days))
  }

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Prévia do portal da ErpIa para uma padaria: receita de R$ 184.320 em 30 dias, fluxo de caixa
        projetado que fica negativo em 18 dias e a sugestão de antecipar R$ 42 mil de recebíveis
        para cobrir o período.
      </figcaption>
      <div
        ref={frame}
        aria-hidden
        className="overflow-hidden rounded-panel border border-line bg-surface shadow-overlay select-none"
      >
        <div className="flex items-stretch">
          <aside className="hidden w-48 shrink-0 flex-col bg-rail p-4 text-sm md:flex">
            <div className="mb-5 flex items-center gap-2">
              <ErpIaMark tone="dark" className="size-6" />
              <Marca className="font-semibold text-rail-ink" />
            </div>
            <div className="flex flex-col gap-1">
              {NAV.map((item, i) => (
                <span
                  key={item}
                  className={
                    i === 0
                      ? 'rounded-control bg-rail-raised px-2.5 py-1.5 text-rail-ink'
                      : 'px-2.5 py-1.5 text-rail-muted'
                  }
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-auto rounded-control bg-rail-raised p-3">
              <p className="text-2xs text-rail-muted">Conta PJ · saldo hoje</p>
              <p className="tabular mt-0.5 font-medium text-rail-ink">{milReais(SALDO_HOJE)}</p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-ink">Padaria Trigo Bom</p>
              <p className="text-xs text-ink-faint">Visão geral · 3 de novembro</p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line lg:grid-cols-4">
              {KPIS.map((kpi, i) => (
                <div key={kpi.label} className="bg-surface p-3">
                  <dt className="truncate text-2xs text-ink-faint sm:text-xs">{kpi.label}</dt>
                  <dd className="tabular mt-1 text-lg font-medium text-ink sm:text-xl">
                    <CountUp
                      to={kpi.to}
                      format={kpi.format}
                      delay={i * T.kpiStagger}
                      run={inView}
                    />
                  </dd>
                  <dd className={`text-2xs ${kpi.tone}`}>{kpi.note}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
              <div className="flex flex-col rounded-control border border-line p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Fluxo de caixa projetado</p>
                  <p className="text-xs text-ink-faint">60 dias</p>
                </div>
                <div
                  data-testid="chart-area"
                  className="relative mt-4 aspect-[10/4] cursor-crosshair touch-pan-y lg:aspect-auto lg:min-h-40 lg:flex-1"
                  onPointerMove={track}
                  onPointerDown={track}
                  onPointerLeave={() => setDay(null)}
                >
                  <svg
                    viewBox={`0 0 ${CHART.width} ${CHART.height}`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full overflow-visible"
                  >
                    <defs>
                      <clipPath id="landing-below-zero">
                        <rect x="0" y={zeroY} width={CHART.width} height={CHART.height - zeroY} />
                      </clipPath>
                    </defs>
                    <path
                      d={area}
                      className={`fill-negative-soft transition-opacity duration-200 ${
                        cardHover ? 'opacity-100' : 'opacity-75'
                      }`}
                      clipPath="url(#landing-below-zero)"
                    />
                    <line
                      x1="0"
                      x2={CHART.width}
                      y1={zeroY}
                      y2={zeroY}
                      className="stroke-line-strong"
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={line}
                      fill="none"
                      className="stroke-accent"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* A cortina (cor do painel) recolhe para a direita e revela a curva. */}
                  <m.span
                    className="pointer-events-none absolute -inset-1 origin-right bg-surface"
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: inView ? 0 : 1 }}
                    transition={{
                      duration: T.curveDuration,
                      ease: [0.45, 0, 0.2, 1],
                      delay: T.curve,
                    }}
                  />
                  <m.span
                    className="pointer-events-none absolute"
                    style={{ left: `${dip.x}%`, top: `${dip.y}%` }}
                    initial="hidden"
                    animate={shown}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      shown: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.3, ease, delay: T.dip },
                      },
                    }}
                  >
                    <span
                      className={`absolute size-2.5 -translate-1/2 rounded-full border-2 border-surface bg-negative transition-transform duration-200 ease-out-expo ${
                        cardHover ? 'scale-150' : ''
                      }`}
                    />
                    <span className="tabular absolute -translate-x-1/2 translate-y-2 text-2xs font-medium whitespace-nowrap text-negative sm:text-xs">
                      {milReais(DIP_VALUE)} em {dataDoDia(DIP_DAY)}
                    </span>
                  </m.span>
                  {day !== null && <ChartCursor day={day} />}
                </div>
                <div className="mt-3 flex justify-between text-2xs text-ink-faint">
                  <span>hoje</span>
                  <span>30 dias</span>
                  <span>60 dias</span>
                </div>
              </div>

              <m.div
                data-testid="credit-card"
                className="flex flex-col rounded-control border border-credit-line bg-credit-soft p-4 transition-[translate,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-credit"
                initial="hidden"
                animate={shown}
                onPointerEnter={() => setCardHover(true)}
                onPointerLeave={() => setCardHover(false)}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  shown: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: T.cardDuration, ease, delay: T.card },
                  },
                }}
              >
                <p className="flex items-center gap-1.5 text-sm font-medium text-credit-ink">
                  <Faisca label={null} />
                  Oportunidade de crédito
                </p>
                <p className="mt-2 text-sm text-ink">
                  Seu caixa fica negativo em 18 dias. Antecipar R$ 42 mil de recebíveis cobre o
                  vale.
                </p>
                <dl className="tabular mt-3 text-xs">
                  <div className={row}>
                    <dt className="text-ink-muted">Em {dataDoDia(DIP_DAY)}, sem crédito</dt>
                    <dd className="font-medium text-negative">{milReais(DIP_VALUE)}</dd>
                  </div>
                  <div className={row}>
                    <dt className="text-ink-muted">Com a antecipação</dt>
                    <dd className="font-medium text-ink">{milReais(DIP_DEPOIS, true)}</dd>
                  </div>
                  <div className={row}>
                    <dt className="text-ink-muted">Devolução</dt>
                    <dd className="text-ink">3 × R$ 14,5 mil</dd>
                  </div>
                </dl>
                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <div>
                    <span className="inline-block rounded-full bg-credit px-2 py-0.5 text-2xs font-medium text-rail">
                      Pré-aprovado
                    </span>
                    <p className="tabular mt-1 text-xl font-medium text-ink">R$ 42.000</p>
                  </div>
                  <span className="rounded-control bg-accent px-3 py-2 text-xs font-medium text-on-accent">
                    Simular
                  </span>
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
