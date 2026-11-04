import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarClock, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { usePortalApi } from '../../api'
import { BarChart } from '../../charts/BarChart'
import { useAnalysis } from '../../layout/queries'
import {
  dayMonth,
  daysFromToday,
  fullDate,
  isoDay,
  money,
  parseDay,
  pct,
  relativeDay,
} from '../../lib/format'
import type { Receivable, ReceivableStatus } from '../../types'
import { Button } from '../../ui/Button'
import { GatedButton } from '../../ui/Gated'
import { DataTable, type Column } from '../../ui/DataTable'
import { SelectField } from '../../ui/Field'
import { InsightBlock } from '../../ui/InsightBlock'
import { OnboardingPendingState } from '../../ui/OnboardingPending'
import { Money } from '../../ui/Money'
import { Pill, type Tone } from '../../ui/Pill'
import { Segmented } from '../../ui/Segmented'
import { StatStrip } from '../../ui/StatStrip'
import { EmptyState, ErrorState, Panel, PanelSkeleton, PageHeader } from '../../ui/Surface'

import { creditErrorMessage, creditKeys, isOnboardingPendente, useOffers } from '../credito/credit'
import { AnticipationSheet } from './AnticipationSheet'

const STATUS: Record<ReceivableStatus, { label: string; filtro: string; tone: Tone }> = {
  PREVISTO: { label: 'A receber', filtro: 'A receber', tone: 'info' },
  RECEBIDO: { label: 'Recebido', filtro: 'Recebidos', tone: 'positive' },
  ANTECIPADO: { label: 'Antecipado', filtro: 'Antecipados', tone: 'accent' },
}

/** Linhas por página da tabela: a agenda de 90 dias passa de 200 itens. */
const PAGINA = 50

const STATUS_OPTIONS = (Object.keys(STATUS) as ReceivableStatus[]).map((value) => ({
  value,
  label: STATUS[value].filtro,
}))

function fimDaSemana(semana: string): string {
  const d = parseDay(semana)
  d.setDate(d.getDate() + 6)
  return isoDay(d)
}

const sum = (items: Receivable[], pick: (r: Receivable) => number) =>
  items.reduce((total, r) => total + pick(r), 0)

const columns: Column<Receivable>[] = [
  {
    key: 'vencimento',
    header: 'Vencimento',
    cell: (r) => (
      <span className="flex flex-col">
        <span className="tabular">{dayMonth(r.vencimento)}</span>
        <span className="text-xs text-ink-muted">{relativeDay(r.vencimento)}</span>
      </span>
    ),
  },
  { key: 'adquirente', header: 'Adquirente', cell: (r) => r.adquirente },
  {
    key: 'bruto',
    header: 'Bruto',
    align: 'right',
    hideBelow: 'sm',
    cell: (r) => <span className="text-ink-muted">{money(r.valor_bruto)}</span>,
  },
  {
    key: 'liquido',
    header: 'Líquido',
    align: 'right',
    cell: (r) => <span className="font-medium">{money(r.valor_liquido)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    hideBelow: 'sm',
    cell: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>,
  },
]

function ReceivablesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Mesma faixa de indicadores da página carregada: só os valores esperam. */}
      <StatStrip
        loading
        stats={[
          'A receber em 90 dias',
          'Próximos 7 dias',
          'Já antecipado',
          'Taxa média do adquirente',
        ].map((label) => ({ label, value: null }))}
      />
      <PanelSkeleton rows={5} label="Carregando agenda" />
    </div>
  )
}

/** Recebíveis: agenda por semana, tabela filtrável e antecipação dos itens selecionados. */
export function ReceivablesPage() {
  const api = usePortalApi()
  const reduce = useReducedMotion()
  const report = useQuery({
    queryKey: creditKeys.receivables,
    queryFn: () => api.erp.receivables(),
  })
  const analysis = useAnalysis()
  const offers = useOffers()
  const insight = analysis.data?.insights.find((i) => i.area === 'recebiveis')
  const oferta = offers.data?.find((o) => o.produto === 'ANTECIPACAO_RECEBIVEIS')

  const [status, setStatus] = useState<ReceivableStatus>('PREVISTO')
  const [adquirente, setAdquirente] = useState('')
  const [semana, setSemana] = useState('')
  // Paginação volta ao início quando os filtros mudam.
  const filtro = `${status}|${adquirente}|${semana}`
  const [pagina, setPagina] = useState({ filtro, limite: PAGINA })
  const limite = pagina.filtro === filtro ? pagina.limite : PAGINA
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [sheet, setSheet] = useState({ open: false, key: 0 })
  const tableRef = useRef<HTMLDivElement>(null)

  const itens = useMemo(() => report.data?.itens ?? [], [report.data])
  const previstos = useMemo(() => itens.filter((r) => r.status === 'PREVISTO'), [itens])
  const adquirentes = useMemo(() => [...new Set(itens.map((r) => r.adquirente))].sort(), [itens])
  const rows = useMemo(
    () =>
      itens
        .filter(
          (r) =>
            r.status === status &&
            (!adquirente || r.adquirente === adquirente) &&
            (!semana || (r.vencimento >= semana && r.vencimento <= fimDaSemana(semana))),
        )
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id - b.id),
    [itens, status, adquirente, semana],
  )
  // Só PREVISTO pode ser antecipado; itens que mudaram de status saem da seleção.
  const selecionados = previstos.filter((r) => selected.has(r.id))
  const liquidoSelecionado = sum(selecionados, (r) => r.valor_liquido)

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = (keys: (string | number)[]) =>
    setSelected((current) => {
      const all = keys.every((k) => current.has(Number(k)))
      const next = new Set(current)
      for (const k of keys) {
        if (all) next.delete(Number(k))
        else next.add(Number(k))
      }
      return next
    })

  const selecionarTudo = () => {
    setStatus('PREVISTO')
    setAdquirente('')
    setSemana('')
    setSelected(new Set(previstos.map((r) => r.id)))
    tableRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  let body
  if (report.isPending) body = <ReceivablesSkeleton />
  else if (report.isError) {
    body = isOnboardingPendente(report.error) ? (
      <OnboardingPendingState area="A agenda de recebíveis" />
    ) : (
      <ErrorState
        message={creditErrorMessage(report.error)}
        onRetry={() => void report.refetch()}
      />
    )
  } else if (itens.length === 0) {
    body = (
      <Panel>
        <EmptyState
          icon={<CalendarClock aria-hidden className="size-5" />}
          title="Nenhum recebível na agenda"
        >
          Vendas no cartão e boletos emitidos pelo ERP entram aqui com a data e o valor líquido de
          cada repasse. A partir deles você antecipa o que precisar.
        </EmptyState>
      </Panel>
    )
  } else {
    const bruto = sum(previstos, (r) => r.valor_bruto)
    const taxas = bruto - sum(previstos, (r) => r.valor_liquido)
    const proximos = previstos.filter((r) => {
      const d = daysFromToday(r.vencimento)
      return d >= 0 && d <= 7
    })
    const antecipados = itens.filter((r) => r.status === 'ANTECIPADO')
    const semanas = report.data.por_semana
    body = (
      <>
        <StatStrip
          stats={[
            {
              label: 'A receber em 90 dias',
              value: <Money value={report.data.total_previsto} size="lg" />,
              detail: `${previstos.length} recebíveis`,
            },
            {
              label: 'Próximos 7 dias',
              value: <Money value={sum(proximos, (r) => r.valor_liquido)} size="lg" />,
              detail: `${proximos.length} recebíveis`,
            },
            {
              label: 'Já antecipado',
              value: <Money value={sum(antecipados, (r) => r.valor_liquido)} size="lg" />,
              detail: `${antecipados.length} recebíveis`,
            },
            {
              label: 'Taxa média do adquirente',
              value: pct(bruto > 0 ? (taxas / bruto) * 100 : 0, 2),
              detail: `${money(taxas)} em taxas a receber`,
            },
          ]}
        />
        <Panel
          id="agenda"
          title="Agenda de recebíveis"
          description="Valor líquido a receber por semana. Clique numa barra para ver a semana."
          actions={
            semana && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSemana('')}
                icon={<X aria-hidden className="size-3.5" />}
              >
                Semana de {dayMonth(semana)}
              </Button>
            )
          }
        >
          {semanas.length > 0 ? (
            <BarChart
              title="Valor líquido a receber por semana"
              data={semanas.map((s) => ({
                key: s.semana,
                label: dayMonth(s.semana),
                value: s.valor,
                detail: `Semana de ${fullDate(s.semana)}`,
                highlight: s.semana === semana,
              }))}
              onSelect={(key) => {
                setStatus('PREVISTO')
                setSemana((current) => (current === key ? '' : key))
              }}
            />
          ) : (
            <p className="py-6 text-sm text-ink-muted">Nada a receber nas próximas semanas.</p>
          )}
        </Panel>
        <div ref={tableRef} className="scroll-mt-4">
          <Panel
            id="recebiveis"
            title="Recebíveis"
            description="Selecione os que estão a receber para simular a antecipação."
            flush
          >
            <div className="flex flex-wrap items-end gap-3 px-5 pb-4">
              <Segmented
                label="Status"
                value={status}
                options={STATUS_OPTIONS}
                onChange={setStatus}
              />
              <SelectField
                label="Adquirente"
                value={adquirente}
                onChange={(e) => setAdquirente(e.currentTarget.value)}
                options={adquirentes.map((a) => ({ value: a, label: a }))}
                placeholder="Todos"
                className="min-w-44"
              />
              <SelectField
                label="Semana"
                value={semana}
                onChange={(e) => setSemana(e.currentTarget.value)}
                options={semanas.map((s) => ({
                  value: s.semana,
                  label: `${dayMonth(s.semana)} a ${dayMonth(fimDaSemana(s.semana))}`,
                }))}
                placeholder="Todas"
                className="min-w-40"
              />
            </div>
            <div className="border-t border-line">
              <DataTable
                caption="Recebíveis"
                columns={columns}
                rows={rows.slice(0, limite)}
                rowKey={(r) => r.id}
                selection={{
                  selected,
                  onToggle: (key) => toggle(Number(key)),
                  onToggleAll: toggleAll,
                  isSelectable: (r) => r.status === 'PREVISTO',
                }}
                empty={
                  <EmptyState
                    title="Nada com esses filtros"
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setAdquirente('')
                          setSemana('')
                        }}
                      >
                        Limpar filtros
                      </Button>
                    }
                  >
                    {status === 'ANTECIPADO'
                      ? 'Você ainda não antecipou recebíveis nesse recorte.'
                      : 'Tente outra semana ou adquirente.'}
                  </EmptyState>
                }
              />
              {rows.length > limite && (
                <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                  <p className="tabular text-xs text-ink-muted">
                    {limite} de {rows.length} recebíveis
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPagina({ filtro, limite: limite + PAGINA })}
                  >
                    Mostrar mais
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        </div>
        <AnimatePresence>
          {selecionados.length > 0 && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="region"
              aria-label="Seleção para antecipação"
              className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line-strong bg-surface px-4 py-3 shadow-overlay"
            >
              <p className="tabular text-sm text-ink" aria-live="polite">
                <span className="font-semibold">
                  {selecionados.length} {selecionados.length === 1 ? 'recebível' : 'recebíveis'}
                </span>
                <span className="text-ink-muted"> · </span>
                {money(liquidoSelecionado)} líquido
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Limpar
                </Button>
                <GatedButton
                  permissao="pedir_credito"
                  size="sm"
                  onClick={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}
                >
                  Simular antecipação
                </GatedButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Recebíveis"
        description="Agenda do que você tem a receber e antecipação."
      />
      <div className="flex flex-col gap-4">
        {(insight || oferta) && !report.isError && (
          <InsightBlock
            insight={insight}
            offer={
              oferta && {
                produto: oferta.produto,
                valor: oferta.limite,
                taxa_mensal: oferta.taxa_mensal_a_partir,
                cta: 'Selecionar recebíveis',
                onAction: previstos.length > 0 ? selecionarTudo : undefined,
              }
            }
          />
        )}
        {body}
      </div>
      <AnticipationSheet
        key={sheet.key}
        open={sheet.open}
        receivables={selecionados}
        onClose={(contracted) => {
          setSheet((s) => ({ ...s, open: false }))
          if (contracted) setSelected(new Set())
        }}
      />
    </>
  )
}
