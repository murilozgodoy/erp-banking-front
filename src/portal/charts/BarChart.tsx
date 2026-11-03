import { scaleBand, scaleLinear } from 'd3-scale'
import { useMemo, useState } from 'react'

import { cn } from '@/lib/cn'
import { money } from '../lib/format'

import { useWidth } from './useSize'

export interface BarDatum {
  key: string
  /** Rótulo curto do eixo (ex.: "12 nov", "S47"). */
  label: string
  value: number
  /** Linha extra do tooltip. */
  detail?: string
  /** Destaca a barra (ex.: semana selecionada para antecipação). */
  highlight?: boolean
}

interface BarChartProps {
  title: string
  data: BarDatum[]
  height?: number
  formatValue?: (value: number) => string
  /** Cor das barras (variável CSS). */
  color?: string
  highlightColor?: string
  onSelect?: (key: string) => void
  className?: string
}

const M = { top: 12, right: 8, bottom: 26, left: 56 }

/** Barras verticais com base em zero, pontas arredondadas, 2 px de respiro e tooltip por barra. */
export function BarChart({
  title,
  data,
  height = 220,
  formatValue = (v) => money(v, { compact: true }),
  color = 'var(--color-series-1)',
  highlightColor = 'var(--color-credit)',
  onSelect,
  className,
}: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const { x, y, ticks, labelEvery } = useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.value))
    const y = scaleLinear()
      .domain([0, max || 1])
      .nice(4)
      .range([height - M.bottom, M.top])
    const x = scaleBand<string>()
      .domain(data.map((d) => d.key))
      .range([M.left, Math.max(M.left + 1, width - M.right)])
      .paddingInner(0.2)
    const fit = Math.max(1, Math.floor((width - M.left) / 56))
    return { x, y, ticks: y.ticks(4), labelEvery: Math.max(1, Math.ceil(data.length / fit)) }
  }, [data, width, height])

  // Poucas categorias: a barra não passa de 56 px e fica centralizada na faixa.
  const band = Math.max(2, x.bandwidth())
  const bw = Math.min(band, 56)
  const inset = (band - bw) / 2
  const radius = Math.min(4, bw / 2)
  const hovered = hover !== null ? data[hover] : null

  return (
    <figure className={cn('relative', className)}>
      <div ref={ref} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={title} className="block">
          {ticks.map((tick) => (
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
          {data.map((d, i) => {
            const top = y(Math.max(0, d.value))
            const h = Math.max(0, y(0) - top)
            const bx = (x(d.key) ?? 0) + inset
            const r = Math.min(radius, h)
            const path = `M${bx},${y(0)} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + bw - r} Q${bx + bw},${top} ${bx + bw},${top + r} V${y(0)} Z`
            return (
              <g key={d.key}>
                <path
                  d={path}
                  fill={d.highlight ? highlightColor : color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                  className="transition-opacity duration-150"
                />
                {/* Alvo de hover maior que a barra. */}
                <rect
                  x={bx - 2}
                  y={M.top}
                  width={bw + 4}
                  height={height - M.top - M.bottom}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={onSelect ? () => onSelect(d.key) : undefined}
                  className={onSelect ? 'cursor-pointer' : undefined}
                />
                {i % labelEvery === 0 && (
                  <text
                    x={bx + bw / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-ink-muted text-[11px]"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {hovered && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-overlay"
            style={{
              left: Math.min(Math.max((x(hovered.key) ?? 0) + inset + bw + 8, 0), width - 170),
            }}
          >
            <p className="font-medium text-ink">{hovered.label}</p>
            <p className="tabular text-ink">{formatValue(hovered.value)}</p>
            {hovered.detail && <p className="text-ink-muted">{hovered.detail}</p>}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
              {d.detail && <td>{d.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
