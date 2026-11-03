import { AlertTriangle, Check } from 'lucide-react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { number, relativeDay } from '../../lib/format'
import { DataTable, type Column } from '../../ui/DataTable'
import { Delta } from '../../ui/Delta'
import { Pill } from '../../ui/Pill'
import { Panel } from '../../ui/Surface'
import type { BusinessAnalysis, FaixaRisco, Kpi, KpiId } from '../../types'

import { benchmarkDiff, FAIXAS, formatKpi, KNOWN_KPIS, LOWER_IS_BETTER } from './kpis'

const columns: Column<Kpi>[] = [
  {
    key: 'label',
    header: 'Indicador',
    cell: (k) => <span className="font-medium">{k.label}</span>,
  },
  { key: 'valor', header: 'Você', align: 'right', cell: (k) => formatKpi(k.valor, k.unidade) },
  {
    key: 'benchmark',
    header: 'Segmento',
    align: 'right',
    hideBelow: 'sm',
    cell: (k) => (
      <span className="text-ink-muted">
        {k.benchmark_segmento === null ? '—' : formatKpi(k.benchmark_segmento, k.unidade)}
      </span>
    ),
  },
  {
    key: 'diff',
    header: 'Diferença',
    align: 'right',
    cell: (k) => {
      const diff = benchmarkDiff(k)
      if (diff === null || !KNOWN_KPIS.has(k.id)) return <span className="text-ink-faint">—</span>
      return <Delta value={diff} inverse={LOWER_IS_BETTER.has(k.id as KpiId)} />
    },
  },
  {
    key: 'leitura',
    header: 'Leitura',
    hideBelow: 'lg',
    className: 'text-ink-muted',
    cell: (k) => k.leitura,
  },
]

function ScoreScale({ score, faixa }: { score: number; faixa: FaixaRisco }) {
  const atual = FAIXAS.find((f) => f.faixa === faixa) ?? FAIXAS[0]
  const position = Math.min(100, Math.max(0, score / 10))
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tabular text-4xl font-semibold tracking-[-0.03em] text-ink">
          {number(score)}
          <span className="text-base font-medium text-ink-muted"> de 1.000</span>
        </p>
        <Pill tone={atual.tone}>{atual.label}</Pill>
      </div>
      <div
        role="meter"
        aria-label="Score do negócio"
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-valuenow={score}
        aria-valuetext={`${score} de 1000, ${atual.label.toLowerCase()}`}
        className="relative mt-5 pt-3"
      >
        <span
          aria-hidden
          className="absolute top-0 -ml-[5px] size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-ink"
          style={{ left: `${position}%` }}
        />
        <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {FAIXAS.map((f) => (
            <span
              key={f.faixa}
              className={cn(f.bar, f.faixa === faixa ? 'opacity-100' : 'opacity-25')}
              style={{ width: `${(f.to - f.from) / 10}%` }}
            />
          ))}
        </div>
        <div aria-hidden className="mt-1.5 flex text-2xs text-ink-muted">
          {FAIXAS.map((f) => (
            <span
              key={f.faixa}
              className={cn('truncate pr-1', f.faixa === faixa && 'font-semibold text-ink')}
              style={{ width: `${(f.to - f.from) / 10}%` }}
            >
              <span className="tabular">{f.from}</span>
              <span className="hidden sm:inline"> · {f.label.replace('Risco ', '')}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Score, faixa, os 9 KPIs contra o segmento e a leitura qualitativa da análise. */
export function ScorePanel({
  analysis,
  className,
}: {
  analysis: BusinessAnalysis
  className?: string
}) {
  const origem =
    analysis.gerado_por === 'llm+regras' ? 'Análise por IA + regras' : 'Análise por regras'
  return (
    <Panel
      id="score"
      title="Score e saúde do negócio"
      description={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {analysis.gerado_por === 'llm+regras' && <Faisca label={null} />}
          {origem}
          {analysis.atualizado_em &&
            ` · atualizada ${relativeDay(analysis.atualizado_em.slice(0, 10))}`}
        </span>
      }
      flush
      className={className}
    >
      <div className="grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6 px-5 pb-5">
          {analysis.score !== null && analysis.faixa_risco && (
            <ScoreScale score={analysis.score} faixa={analysis.faixa_risco} />
          )}
          <div className="grid gap-5 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-1">
            <ReadingList title="Pontos fortes" items={analysis.pontos_fortes} tone="positive" />
            <ReadingList title="Riscos" items={analysis.riscos} tone="warning" />
          </div>
        </div>
        <div className="border-t border-line xl:border-t-0 xl:border-l">
          {analysis.kpis.length > 0 ? (
            <DataTable
              caption="Indicadores do negócio: você e a média do segmento"
              columns={columns}
              rows={analysis.kpis}
              rowKey={(k) => k.id}
            />
          ) : (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Os indicadores aparecem depois de 30 dias de vendas registradas no ERP.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function ReadingList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'warning'
}) {
  if (!items.length) return null
  const Icon = tone === 'positive' ? Check : AlertTriangle
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-ink-muted">
            <Icon
              aria-hidden
              className={cn(
                'mt-0.5 size-4 shrink-0',
                tone === 'positive' ? 'text-positive' : 'text-warning',
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
