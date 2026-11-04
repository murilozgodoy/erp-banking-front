import { CalendarClock, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { dayMonth, relativeDay } from '../../lib/format'
import type { Payable, PayableStatus, PayablesReport } from '../../types'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { GatedButton } from '../../ui/Gated'
import { Money } from '../../ui/Money'
import { Pill } from '../../ui/Pill'
import { Segmented } from '../../ui/Segmented'
import { EmptyState, ErrorState, Panel } from '../../ui/Surface'
import { RowsSkeleton } from './RowsSkeleton'
import { CATEGORIA_LABEL, pagavel, STATUS_PILL } from './model'
import { usePaymentHistory } from './queries'

const FILTROS: { value: PayableStatus; label: string }[] = [
  { value: 'ABERTO', label: 'Abertas' },
  { value: 'ATRASADO', label: 'Atrasadas' },
  { value: 'AGENDADO', label: 'Agendadas' },
  { value: 'PAGO', label: 'Pagas' },
]

const PAGE = 10

const VAZIO: Record<PayableStatus, { title: string; text: string }> = {
  ABERTO: {
    title: 'Nenhuma conta em aberto',
    text: 'As contas lançadas no ERP (fornecedores, folha, impostos) aparecem aqui com o vencimento. Para pagar algo fora do ERP, use Novo pagamento.',
  },
  ATRASADO: {
    title: 'Nada atrasado',
    text: 'Conta em aberto que passa do vencimento vem para cá, com juros correndo. Agende as próximas para não perder a data.',
  },
  AGENDADO: {
    title: 'Nenhum pagamento agendado',
    text: 'Ao pagar uma conta, escolha Agendar e a data: o valor sai da conta só no dia, e a conta fica aqui até lá.',
  },
  PAGO: {
    title: 'Nenhuma conta paga ainda',
    text: 'Contas pagas pelo portal ou pelo banco aparecem aqui com a data do pagamento.',
  },
}

interface PayablesPanelProps {
  query: {
    data?: PayablesReport
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  onPay: (conta: Payable) => void
  onNew: () => void
}

/** Contas a pagar do ERP, filtradas por status, com "Pagar" na linha. */
export function PayablesPanel({ query, onPay, onNew }: PayablesPanelProps) {
  const [filtro, setFiltro] = useState<PayableStatus>('ABERTO')
  // Conta paga acima do limite de alguém: fica aberta, mas com o pagamento esperando aprovação.
  const history = usePaymentHistory()
  const pendentes = useMemo(
    () =>
      new Set(
        (history.data ?? [])
          .filter((p) => p.status === 'PENDENTE_APROVACAO' && p.payable_id !== null)
          .map((p) => p.payable_id),
      ),
    [history.data],
  )
  const itens = useMemo(() => query.data?.itens ?? [], [query.data])
  const counts = useMemo(() => {
    const result: Record<PayableStatus, number> = { ABERTO: 0, ATRASADO: 0, AGENDADO: 0, PAGO: 0 }
    for (const conta of itens) result[conta.status]++
    return result
  }, [itens])
  const [limit, setLimit] = useState(PAGE)
  // Ordem de vencimento antes de paginar (pagas: mais recentes primeiro).
  const rows = useMemo(
    () =>
      itens
        .filter((c) => c.status === filtro)
        .sort((a, b) =>
          filtro === 'PAGO'
            ? b.vencimento.localeCompare(a.vencimento)
            : a.vencimento.localeCompare(b.vencimento),
        ),
    [itens, filtro],
  )

  const quando = (c: Payable) =>
    c.status === 'PAGO' && c.pago_em
      ? `paga em ${dayMonth(c.pago_em)}`
      : c.status === 'ATRASADO'
        ? `atrasada ${relativeDay(c.vencimento)}`
        : relativeDay(c.vencimento)
  const tomQuando = (c: Payable) =>
    c.status === 'ATRASADO' ? 'font-medium text-negative' : 'text-ink-muted'

  const columns: Column<Payable>[] = [
    {
      key: 'fornecedor',
      header: 'Fornecedor',
      sort: (c) => c.fornecedor,
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-pretty text-ink">{c.fornecedor}</p>
          <p className="text-xs text-ink-muted">
            {CATEGORIA_LABEL[c.categoria]}
            {c.codigo_barras ? ' · boleto' : ''}
          </p>
          {/* No celular a coluna de vencimento sai e a data vem aqui: valor e "Pagar" cabem na tela. */}
          <p className={cn('tabular text-xs whitespace-nowrap sm:hidden', tomQuando(c))}>
            {dayMonth(c.vencimento)} · {quando(c)}
          </p>
        </div>
      ),
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      hideBelow: 'sm',
      sort: (c) => c.vencimento,
      cell: (c) => (
        <div className="tabular whitespace-nowrap">
          <p className="text-ink">{dayMonth(c.vencimento)}</p>
          <p className={cn('text-xs', tomQuando(c))}>{quando(c)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'sm',
      cell: (c) => <Pill tone={STATUS_PILL[c.status].tone}>{STATUS_PILL[c.status].label}</Pill>,
    },
    {
      key: 'valor',
      header: 'Valor',
      align: 'right',
      sort: (c) => c.valor,
      cell: (c) => <Money value={c.valor} size="sm" />,
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      cell: (c) =>
        pendentes.has(c.id) ? (
          <Pill tone="warning">Pendente de aprovação</Pill>
        ) : pagavel(c) ? (
          <GatedButton
            permissao="pagar"
            size="sm"
            variant={c.status === 'ATRASADO' ? 'primary' : 'secondary'}
            onClick={() => onPay(c)}
            aria-label={`Pagar ${c.fornecedor}, vencimento ${dayMonth(c.vencimento)}`}
          >
            Pagar
          </GatedButton>
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        ),
    },
  ]

  const empty = VAZIO[filtro]

  return (
    <Panel
      id="contas"
      title="Contas a pagar"
      description="Lançadas no ERP. Pague na linha ou agende para o vencimento."
      actions={
        <Segmented
          label="Filtrar contas por status"
          value={filtro}
          options={FILTROS.map((f) => ({
            value: f.value,
            label: query.data ? `${f.label} ${counts[f.value]}` : f.label,
          }))}
          onChange={(value) => {
            setFiltro(value)
            setLimit(PAGE)
          }}
          className="max-w-full overflow-x-auto"
        />
      }
      flush
    >
      {query.isPending ? (
        <RowsSkeleton rows={5} label="Carregando contas a pagar" />
      ) : query.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            title="Não conseguimos carregar as contas a pagar"
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : (
        <>
          <DataTable
            key={filtro}
            caption={`Contas a pagar: ${FILTROS.find((f) => f.value === filtro)?.label}`}
            columns={columns}
            rows={rows.slice(0, limit)}
            rowKey={(c) => c.id}
            initialSort={{ key: 'vencimento', direction: filtro === 'PAGO' ? 'desc' : 'asc' }}
            empty={
              <EmptyState
                icon={
                  filtro === 'AGENDADO' ? (
                    <CalendarClock className="size-5" />
                  ) : (
                    <Receipt className="size-5" />
                  )
                }
                title={empty.title}
                action={
                  filtro === 'ABERTO' ? (
                    <GatedButton permissao="pagar" variant="secondary" size="sm" onClick={onNew}>
                      Novo pagamento
                    </GatedButton>
                  ) : undefined
                }
              >
                {empty.text}
              </EmptyState>
            }
          />
          {rows.length > limit && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE * 2)}>
                Mostrar mais contas ({rows.length - limit} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
