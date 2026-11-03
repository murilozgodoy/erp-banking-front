import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { dayMonth, fullDate, money, pct } from '../../lib/format'
import type { Simulation } from '../../types'
import { DataTable, type Column } from '../../ui/DataTable'
import { Money } from '../../ui/Money'
import { Pill, type Tone } from '../../ui/Pill'

const APROVACAO: Record<Simulation['aprovacao'], { label: string; tone: Tone; texto: string }> = {
  PRE_APROVADO: {
    label: 'Pré-aprovado',
    tone: 'credit',
    texto: 'Dentro do seu limite: o dinheiro cai na conta assim que você contratar.',
  },
  ANALISE: {
    label: 'Vai para análise',
    tone: 'warning',
    texto:
      'Acima do limite pré-aprovado: a proposta passa pelo time de crédito antes da liberação.',
  },
  NEGADO: {
    label: 'Não aprovado',
    tone: 'negative',
    texto:
      'Este valor passa da capacidade de pagamento estimada. Reduza o valor ou alongue o prazo.',
  },
}

export function AprovacaoPill({ aprovacao }: { aprovacao: Simulation['aprovacao'] }) {
  const info = APROVACAO[aprovacao]
  return (
    <Pill tone={info.tone} dot={aprovacao !== 'PRE_APROVADO'}>
      {aprovacao === 'PRE_APROVADO' && <Faisca label={null} className="size-3" />}
      {info.label}
    </Pill>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="tabular text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}

const columns: Column<Simulation['parcelas'][number]>[] = [
  { key: 'n', header: 'Parcela', cell: (p) => <span className="tabular">{p.n}</span> },
  { key: 'vencimento', header: 'Vencimento', cell: (p) => dayMonth(p.vencimento) },
  {
    key: 'amortizacao',
    header: 'Amortização',
    align: 'right',
    hideBelow: 'sm',
    cell: (p) => money(p.amortizacao),
  },
  { key: 'juros', header: 'Juros', align: 'right', hideBelow: 'sm', cell: (p) => money(p.juros) },
  { key: 'valor', header: 'Valor', align: 'right', cell: (p) => money(p.valor) },
]

/** Cronograma de parcelas, recolhido por padrão. */
export function Schedule({ simulation }: { simulation: Simulation }) {
  const [open, setOpen] = useState(false)
  const regionId = useId()
  const n = simulation.parcelas.length
  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-control py-3 text-sm font-medium text-ink hover:text-accent"
      >
        {open ? 'Ocultar cronograma' : `Ver cronograma (${n} ${n === 1 ? 'parcela' : 'parcelas'})`}
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={regionId} className="-mx-5 border-t border-line sm:mx-0 sm:border-t-0">
          <DataTable
            caption="Cronograma de parcelas"
            columns={columns}
            rows={simulation.parcelas}
            rowKey={(p) => p.n}
          />
        </div>
      )}
    </div>
  )
}

interface SimulationResultProps {
  simulation: Simulation
  /** Recalculando: o resultado anterior fica esmaecido. */
  pending?: boolean
  /** `parcela`: destaque na parcela mensal (crédito); `liquido`: no valor que cai na conta. */
  hero?: 'parcela' | 'liquido'
}

/** Condições da simulação: o número que decide, taxas, custo total e a resposta de aprovação. */
export function SimulationResult({ simulation, pending, hero = 'parcela' }: SimulationResultProps) {
  const n = simulation.parcelas.length
  const parcela = simulation.parcelas[0]?.valor ?? 0
  const aprovacao = APROVACAO[simulation.aprovacao]
  return (
    <div
      aria-live="polite"
      aria-busy={pending || undefined}
      className={cn('transition-opacity duration-150', pending && 'opacity-60')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            {hero === 'parcela'
              ? n === 1
                ? 'Pagamento único'
                : `Parcela mensal · ${n}x`
              : 'Valor líquido na conta'}
          </p>
          <Money value={hero === 'parcela' ? parcela : simulation.valor_liquido} size="display" />
        </div>
        <AprovacaoPill aprovacao={simulation.aprovacao} />
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-ink-muted">{aprovacao.texto}</p>
      <dl className="mt-4 divide-y divide-line border-t border-line">
        {hero === 'parcela' ? (
          <Row label="Valor líquido na conta">{money(simulation.valor_liquido)}</Row>
        ) : (
          <Row label={n === 1 ? 'Pagamento único' : `Parcela mensal · ${n}x`}>{money(parcela)}</Row>
        )}
        <Row label="Taxa">{pct(simulation.taxa_mensal, 2)} a.m.</Row>
        <Row label="CET">{pct(simulation.cet_anual, 2)} a.a.</Row>
        <Row label="IOF">{money(simulation.iof)}</Row>
        <Row label="Total pago">{money(simulation.total_pago)}</Row>
        <Row label="Válida até">{fullDate(simulation.validade)}</Row>
      </dl>
      <Schedule simulation={simulation} />
    </div>
  )
}
