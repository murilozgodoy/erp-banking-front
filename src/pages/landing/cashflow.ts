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

/**
 * O mesmo caixa depois de antecipar R$ 42 mil de recebíveis antes do vale: o dia 18 fica em
 * +R$ 10,2 mil e, a partir do dia 30, as 3 parcelas (R$ 14,5 mil cada, 1,29% a.m.) saem do caixa.
 * Mesmos dias de `CASHFLOW`, para a curva poder fazer o morph de uma para a outra.
 */
export const CASHFLOW_ANTECIPADO: [day: number, value: number][] = [
  [0, 38],
  [5, 30],
  [10, 13],
  [14, 16],
  [18, 10.2],
  [22, 18],
  [26, 38],
  [30, 39.5],
  [35, 47.5],
  [40, 44.5],
  [45, 44],
  [50, 53],
  [55, 64],
  [60, 61.5],
]
