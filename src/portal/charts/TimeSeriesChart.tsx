import { scaleLinear, scaleTime } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import { useId, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { dayMonth, money, parseDay } from '../lib/format'

import { useWidth } from './useSize'

export interface TimeSeries {
  key: string
  label: string
  /** Variável CSS da cor (ex.: `var(--color-series-1)`). */
  color: string
  values: { date: string; value: number }[]
  /** Preenche a área sob a linha (só a primeira série deve usar). */
  area?: boolean
  /** Tracejada (ex.: projeção). */
  dashed?: boolean
}

export interface Band {
  from: string
  to: string
  label: string
  /** Classe de cor do preenchimento (ex.: `fill-negative/10`). */
  className: string
}

interface TimeSeriesChartProps {
  /** Título do gráfico (vira o nome acessível e o caption da tabela). */
  title: string
  series: TimeSeries[]
  height?: number
  /** Faixas verticais destacadas (vale de caixa, período de antecipação). */
  bands?: Band[]
  /** Linha vertical "hoje" ou outro marco. */
  marker?: { date: string; label: string }
  formatValue?: (value: number) => string
  /** Pinta abaixo de zero em vermelho suave. */
  negativeZone?: boolean
  /** Conteúdo extra do tooltip para a data em foco. */
  tooltipExtra?: (date: string) => ReactNode
  className?: string
}

const M = { top: 12, right: 12, bottom: 26, left: 56 }

/**
 * Série temporal (linha/área) com um eixo só, grade recessiva, crosshair + tooltip no hover
 * e no teclado (setas), e tabela equivalente para leitores de tela.
 */
export function TimeSeriesChart({
  title,
  series,
  height = 260,
  bands = [],
  marker,
  formatValue = (v) => money(v, { compact: true }),
  negativeZone = false,
  tooltipExtra,
  className,
}: TimeSeriesChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const clipId = useId()
  const [focus, setFocus] = useState<number | null>(null)

  const dates = useMemo(() => series[0]?.values.map((p) => p.date) ?? [], [series])
  const { x, y, ticksY, ticksX } = useMemo(() => {
    const all = series.flatMap((s) => s.values.map((p) => p.value))
    const min = Math.min(0, ...all)
    const max = Math.max(0, ...all)
    const pad = (max - min || 1) * 0.08
    const y = scaleLinear()
      .domain([min < 0 ? min - pad : 0, max + pad])
      .nice(4)
      .range([height - M.bottom, M.top])
    const x = scaleTime()
      .domain([
        parseDay(dates[0] ?? '2026-01-01'),
        parseDay(dates[dates.length - 1] ?? '2026-01-02'),
      ])
      .range([M.left, Math.max(M.left + 1, width - M.right)])
    const tickCount = Math.max(2, Math.floor((width - M.left) / 90))
    const step = Math.max(1, Math.ceil(dates.length / tickCount))
    return {
      x,
      y,
      ticksY: y.ticks(4),
      ticksX: dates.filter((_, i) => i % step === 0),
    }
  }, [series, dates, width, height])

  const px = (date: string) => x(parseDay(date))
  const zeroY = y(0)
  const focusDate = focus !== null ? dates[focus] : null

  const onPointer = (clientX: number, rect: DOMRect) => {
    if (!dates.length) return
    const date = x.invert(clientX - rect.left)
    let best = 0
    dates.forEach((d, i) => {
      if (
        Math.abs(parseDay(d).getTime() - date.getTime()) <
        Math.abs(parseDay(dates[best]).getTime() - date.getTime())
      )
        best = i
    })
    setFocus(best)
  }

  return (
    <figure className={cn('relative', className)}>
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={title}
          tabIndex={0}
          className="block touch-pan-y rounded-control outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onPointerMove={(e) => onPointer(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setFocus(null)}
          onBlur={() => setFocus(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            setFocus((f) => {
              const base = f ?? (e.key === 'ArrowRight' ? -1 : dates.length)
              return Math.min(
                dates.length - 1,
                Math.max(0, base + (e.key === 'ArrowRight' ? 1 : -1)),
              )
            })
          }}
        >
          <defs>
            <clipPath id={`${clipId}-neg`}>
              <rect
                x={M.left}
                y={zeroY}
                width={Math.max(0, width - M.left - M.right)}
                height={Math.max(0, height - M.bottom - zeroY)}
              />
            </clipPath>
          </defs>

          {bands.map((band) => (
            <g key={band.label}>
              <rect
                x={px(band.from)}
                y={M.top}
                width={Math.max(2, px(band.to) - px(band.from))}
                height={height - M.top - M.bottom}
                className={band.className}
              />
            </g>
          ))}

          {ticksY.map((tick) => (
            <g key={tick}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'}
                strokeDasharray={tick === 0 ? undefined : '2 4'}
              />
              <text
                x={M.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="tabular fill-ink-muted text-[11px]"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {ticksX.map((date) => (
            <text
              key={date}
              x={px(date)}
              y={height - 8}
              textAnchor="middle"
              className="fill-ink-muted text-[11px]"
            >
              {dayMonth(date)}
            </text>
          ))}

          {series.map((s) => {
            const points = s.values.map((p) => [px(p.date), y(p.value)] as [number, number])
            const path = line().curve(curveMonotoneX)(points) ?? ''
            const fill = s.area ? (area().curve(curveMonotoneX).y0(zeroY)(points) ?? '') : ''
            return (
              <g key={s.key}>
                {s.area && <path d={fill} fill={s.color} opacity={0.12} />}
                {s.area && negativeZone && (
                  <path
                    d={fill}
                    clipPath={`url(#${clipId}-neg)`}
                    className="fill-negative"
                    opacity={0.28}
                  />
                )}
                <path
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  strokeLinecap="round"
                />
                {negativeZone && (
                  <path
                    d={path}
                    fill="none"
                    clipPath={`url(#${clipId}-neg)`}
                    className="stroke-negative"
                    strokeWidth={2}
                  />
                )}
              </g>
            )
          })}

          {marker && (
            <g>
              <line
                x1={px(marker.date)}
                x2={px(marker.date)}
                y1={M.top}
                y2={height - M.bottom}
                className="stroke-ink-faint"
                strokeDasharray="3 3"
              />
              <text x={px(marker.date) + 4} y={M.top + 10} className="fill-ink-muted text-[11px]">
                {marker.label}
              </text>
            </g>
          )}

          {focusDate && (
            <g pointerEvents="none">
              <line
                x1={px(focusDate)}
                x2={px(focusDate)}
                y1={M.top}
                y2={height - M.bottom}
                className="stroke-ink-faint"
              />
              {series.map((s) => {
                const point = s.values[focus!]
                return point ? (
                  <circle
                    key={s.key}
                    cx={px(point.date)}
                    cy={y(point.value)}
                    r={4.5}
                    fill={s.color}
                    className="stroke-surface"
                    strokeWidth={2}
                  />
                ) : null
              })}
            </g>
          )}
        </svg>

        {focusDate && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-overlay"
            style={{
              left: Math.min(Math.max(px(focusDate) + 12, 0), width - 180),
            }}
          >
            <p className="mb-1 font-medium text-ink">{dayMonth(focusDate)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular font-medium text-ink">
                  {formatValue(s.values[focus!]?.value ?? 0)}
                </span>
              </p>
            ))}
            {tooltipExtra?.(focusDate)}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded"
                style={{ background: s.color, opacity: s.dashed ? 0.7 : 1 }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}

      {/* div: tabela com largura de 1 px ainda empurra o scroll horizontal no Chrome. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date, i) => (
              <tr key={date}>
                <th scope="row">{dayMonth(date)}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatValue(s.values[i]?.value ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
