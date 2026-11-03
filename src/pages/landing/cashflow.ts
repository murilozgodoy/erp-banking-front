/** Fluxo de caixa projetado de 60 dias da empresa de exemplo (em milhares de reais). */
export const CASHFLOW: [day: number, value: number][] = [
  [0, 38],
  [5, 30],
  [10, 13],
  [14, -14],
  [18, -31.8],
  [22, -24],
  [26, -4],
  [30, 12],
  [35, 20],
  [40, 17],
  [45, 31],
  [50, 40],
  [55, 51],
  [60, 63],
]

export const CHART = { width: 600, height: 180, days: 60, min: -45, max: 75 } as const

export const toX = (day: number) => (day / CHART.days) * CHART.width
export const toY = (value: number) => ((CHART.max - value) / (CHART.max - CHART.min)) * CHART.height

/** Curva suave (Catmull-Rom convertida em Bézier cúbica) pelos pontos. */
export function smoothPath(points: [number, number][]): string {
  const p = points.map(([d, v]) => [toX(d), toY(v)] as const)
  let path = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    path += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return path
}
