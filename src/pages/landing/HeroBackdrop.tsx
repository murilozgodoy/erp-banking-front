import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useSyncExternalStore } from 'react'

import { cn } from '@/lib/cn'

/** Espaço do desenho: o SVG estica para a largura e a altura do hero (as faixas são suaves). */
const W = 1440
const H = 720

type Band = {
  /** Altura da borda superior na esquerda e quanto ela sobe até a direita (fluxo crescendo). */
  base: number
  rise: number
  /** Ondulação: amplitude, número de ondas na largura e fase. */
  amp: number
  waves: number
  phase: number
  /** Espessura média da faixa. */
  thickness: number
  /** Opacidade no tema claro e no escuro (o escuro aguenta mais sem perder contraste). */
  tone: string
  /** Deriva em % do próprio tamanho (x, y), período de cada eixo em segundos e defasagem. */
  drift: [number, number]
  period: [number, number]
  offset: number
}

/**
 * Quatro faixas largas, levemente diagonais, como curvas de fluxo de caixa suavizadas. As
 * opacidades somam pouco mesmo onde se cruzam, e a máscara do contêiner deixa o lado do título
 * quase limpo.
 */
const BANDS: Band[] = [
  {
    base: 600,
    rise: 330,
    amp: 30,
    waves: 1.15,
    phase: 0.4,
    thickness: 120,
    tone: 'opacity-[0.07] dark:opacity-[0.11]',
    drift: [2.4, 3],
    period: [46, 34],
    offset: 0,
  },
  {
    base: 500,
    rise: 340,
    amp: 40,
    waves: 0.8,
    phase: 2.1,
    thickness: 170,
    tone: 'opacity-[0.05] dark:opacity-[0.08]',
    drift: [-3, 2.2],
    period: [58, 41],
    offset: 9,
  },
  {
    base: 690,
    rise: 230,
    amp: 26,
    waves: 1.4,
    phase: 4,
    thickness: 96,
    tone: 'opacity-[0.04] dark:opacity-[0.065]',
    drift: [2, -2.6],
    period: [37, 52],
    offset: 17,
  },
  {
    base: 400,
    rise: 360,
    amp: 22,
    waves: 0.6,
    phase: 5.3,
    thickness: 220,
    tone: 'opacity-[0.03] dark:opacity-[0.05]',
    drift: [-2, 2.4],
    period: [60, 29],
    offset: 23,
  },
]

/** A faixa que leva o fio lima (a única lima do fundo), pela borda superior. */
const THREAD_BAND = 1

const SAMPLES = 14
const X0 = -60
const X1 = W + 60

function edge(band: Band, x: number, below: boolean) {
  const t = x / W
  const wave =
    Math.sin(2 * Math.PI * band.waves * t + band.phase) +
    0.32 * Math.sin(2 * Math.PI * band.waves * 2.3 * t + band.phase * 1.7)
  const top = band.base - band.rise * t + band.amp * wave
  if (!below) return top
  // A espessura respira ao longo da largura, para a faixa não parecer uma fita de régua.
  return top + band.thickness * (0.78 + 0.22 * Math.sin(2 * Math.PI * 0.7 * t + band.phase * 0.5))
}

function points(band: Band, below: boolean): [number, number][] {
  return Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const x = X0 + ((X1 - X0) * i) / SAMPLES
    return [x, edge(band, x, below)]
  })
}

/** Catmull-Rom em Bézier cúbica, continuando de onde o caminho já está. */
function curveThrough(p: [number, number][]) {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function openPath(p: [number, number][]) {
  return `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}${curveThrough(p)}`
}

function ribbonPath(band: Band) {
  const top = points(band, false)
  const bottom = points(band, true).reverse()
  const [bx, by] = bottom[0]
  return `${openPath(top)} L${bx.toFixed(1)},${by.toFixed(1)}${curveThrough(bottom)} Z`
}

const SHAPES = BANDS.map((band) => ({
  band,
  d: ribbonPath(band),
  top: openPath(points(band, false)),
}))

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/** A aba está visível? (aba em segundo plano pausa a deriva.) */
function usePageVisible() {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true,
  )
}

/**
 * "Linhas de fluxo": faixas largas de esmeralda que derivam devagar atrás do hero. Só
 * transform, uma camada composta por faixa; para com "reduzir movimento", fora da tela e com a
 * aba em segundo plano. Decorativo: `aria-hidden` e sem ponteiro.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  const still = useReducedMotion() === true
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const pageVisible = usePageVisible()
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const controls = useRef<ReturnType<typeof animate>[]>([])
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const running = !still && inView && pageVisible

  useEffect(() => {
    if (still) return
    const options = { ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' } as const
    const created = BANDS.flatMap((band, i) => {
      const layer = layers.current[i]
      if (!layer) return []
      const [dx, dy] = band.drift
      const x = animate(
        layer,
        { x: [`${-dx}%`, `${dx}%`] },
        { ...options, duration: band.period[0] },
      )
      const y = animate(
        layer,
        { y: [`${-dy}%`, `${dy}%`] },
        { ...options, duration: band.period[1] },
      )
      // Cada faixa começa num ponto diferente do ciclo, para nunca andarem em bloco.
      x.time = band.offset
      y.time = band.offset * 0.6
      return [x, y]
    })
    controls.current = created
    return () => {
      for (const c of created) c.stop()
      controls.current = []
    }
  }, [still])

  useEffect(() => {
    for (const c of controls.current) {
      if (running) c.play()
      else c.pause()
    }
  }, [running, still])

  return (
    <div
      ref={ref}
      aria-hidden
      data-still={still || undefined}
      className={cn('hero-backdrop-mask pointer-events-none absolute overflow-hidden', className)}
    >
      {SHAPES.map(({ band, d, top }, i) => (
        <div
          key={band.base}
          ref={(el) => {
            layers.current[i] = el
          }}
          className="absolute inset-y-0 -right-[6%] -left-[6%] will-change-transform"
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            focusable="false"
          >
            <defs>
              <linearGradient
                id={`${uid}-band-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={X0}
                y1={0}
                x2={X1}
                y2={0}
              >
                <stop offset="0.1" stopOpacity="0" className="[stop-color:var(--erpia-accent)]" />
                <stop offset="0.4" stopOpacity="1" className="[stop-color:var(--erpia-accent)]" />
                <stop offset="0.7" stopOpacity="1" className="[stop-color:var(--erpia-accent)]" />
                <stop offset="0.93" stopOpacity="0" className="[stop-color:var(--erpia-accent)]" />
              </linearGradient>
              {i === THREAD_BAND && (
                <linearGradient
                  id={`${uid}-thread`}
                  gradientUnits="userSpaceOnUse"
                  x1={X0}
                  y1={0}
                  x2={X1}
                  y2={0}
                >
                  <stop
                    offset="0.35"
                    stopOpacity="0"
                    className="[stop-color:var(--erpia-credit)]"
                  />
                  <stop offset="0.6" stopOpacity="1" className="[stop-color:var(--erpia-credit)]" />
                  <stop
                    offset="0.86"
                    stopOpacity="0"
                    className="[stop-color:var(--erpia-credit)]"
                  />
                </linearGradient>
              )}
            </defs>
            <path d={d} fill={`url(#${uid}-band-${i})`} className={band.tone} />
            {i === THREAD_BAND && (
              <path
                d={top}
                fill="none"
                stroke={`url(#${uid}-thread)`}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="opacity-[0.25]"
                data-thread
              />
            )}
          </svg>
        </div>
      ))}
    </div>
  )
}
