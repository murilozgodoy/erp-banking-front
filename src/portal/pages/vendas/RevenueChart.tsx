import { BarChart } from '../../charts/BarChart'
import { TimeSeriesChart } from '../../charts/TimeSeriesChart'
import { money, number, pct } from '../../lib/format'
import { Panel } from '../../ui/Surface'
import type { GroupBy, SalesReport } from '../../types'

import { bestPeriod, periodLabel, periodTitle, weekendShare } from './period'

const BEST_LABEL: Record<GroupBy, string> = {
  day: 'Melhor dia',
  week: 'Melhor semana',
  month: 'Melhor mês',
}

const UNIT: Record<GroupBy, string> = { day: 'dia', week: 'semana', month: 'mês' }

function vendas(quantidade: number): string {
  return `${number(quantidade)} ${quantidade === 1 ? 'venda' : 'vendas'}`
}

/** Faturamento no tempo: barras para dia/semana/mês; linha quando a série diária é longa. */
export function RevenueChart({ report, group }: { report: SalesReport; group: GroupBy }) {
  const best = bestPeriod(report)
  const weekend = group === 'day' ? weekendShare(report) : null
  const useLine = group === 'day' && report.serie.length > 45
  const title = `Faturamento por ${UNIT[group]}`

  return (
    <Panel
      id="vendas-faturamento"
      title={title}
      description={
        best ? (
          <>
            {BEST_LABEL[group]}: {periodTitle(best.periodo, group)},{' '}
            <span className="tabular font-medium text-ink">{money(best.valor)}</span>
            {weekend !== null && (
              <>
                {' · '}fins de semana somam{' '}
                <span className="tabular font-medium text-ink">{pct(weekend, 0)}</span> da receita
              </>
            )}
          </>
        ) : undefined
      }
      actions={
        best && !useLine ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden className="size-2.5 rounded-sm bg-series-2" />
            {BEST_LABEL[group]}
          </p>
        ) : undefined
      }
    >
      {useLine ? (
        <TimeSeriesChart
          title={title}
          height={260}
          series={[
            {
              key: 'faturamento',
              label: 'Faturamento',
              color: 'var(--color-series-1)',
              area: true,
              values: report.serie.map((p) => ({ date: p.periodo, value: p.valor })),
            },
          ]}
          marker={best ? { date: best.periodo, label: BEST_LABEL[group] } : undefined}
          tooltipExtra={(date) => {
            const point = report.serie.find((p) => p.periodo === date)
            return point ? (
              <p className="tabular mt-0.5 text-ink-muted">{vendas(point.quantidade)}</p>
            ) : null
          }}
        />
      ) : (
        <BarChart
          title={title}
          height={240}
          highlightColor="var(--color-series-2)"
          data={report.serie.map((p) => ({
            key: p.periodo,
            label: periodLabel(p.periodo, group),
            value: p.valor,
            detail: vendas(p.quantidade),
            highlight: best?.periodo === p.periodo,
          }))}
        />
      )}
    </Panel>
  )
}
