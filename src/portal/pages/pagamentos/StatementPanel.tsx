import { ArrowDownLeft, ArrowUpRight, ScrollText } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { money } from '../../lib/format'
import type { StatementEntry } from '../../types'
import { Button } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { Segmented } from '../../ui/Segmented'
import { EmptyState, ErrorState, Panel, PanelSkeleton } from '../../ui/Surface'
import { useStatement } from './queries'

type Periodo = '7' | '30' | '90'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
]

const PAGE = 15

const when = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function Valor({ entry }: { entry: StatementEntry }) {
  const credit = entry.tipo === 'CREDIT'
  const Icon = credit ? ArrowDownLeft : ArrowUpRight
  return (
    <span
      className={cn(
        'tabular inline-flex items-center justify-end gap-1 font-semibold whitespace-nowrap',
        credit ? 'text-positive' : 'text-ink',
      )}
    >
      <Icon aria-hidden className={cn('size-3.5', credit ? 'text-positive' : 'text-negative')} />
      <span className="sr-only">{credit ? 'Entrada de' : 'Saída de'} </span>
      {credit ? '+' : '−'}
      {money(entry.valor)}
    </span>
  )
}

/** Extrato da conta PJ: entradas e saídas com o saldo após cada lançamento. */
export function StatementPanel() {
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [limit, setLimit] = useState(PAGE)
  const statement = useStatement(Number(periodo))
  const entries = statement.data ?? []

  const columns: Column<StatementEntry>[] = [
    {
      key: 'data',
      header: 'Data',
      cell: (e) => (
        <span className="tabular whitespace-nowrap text-ink-muted">
          {when.format(new Date(e.data)).replace('.', '')}
        </span>
      ),
    },
    {
      key: 'descricao',
      header: 'Lançamento',
      cell: (e) => <span className="line-clamp-2 text-ink">{e.descricao}</span>,
    },
    { key: 'valor', header: 'Valor', align: 'right', cell: (e) => <Valor entry={e} /> },
    {
      key: 'saldo',
      header: 'Saldo após',
      align: 'right',
      hideBelow: 'sm',
      cell: (e) => (
        <span
          className={cn('whitespace-nowrap', e.saldo_apos < 0 ? 'text-negative' : 'text-ink-muted')}
        >
          {money(e.saldo_apos)}
        </span>
      ),
    },
  ]

  return (
    <Panel
      id="extrato"
      title="Extrato"
      description="Entradas e saídas da conta PJ, do mais recente ao mais antigo."
      actions={
        <Segmented
          label="Período do extrato"
          value={periodo}
          options={PERIODOS}
          onChange={(value) => {
            setPeriodo(value)
            setLimit(PAGE)
          }}
        />
      }
      flush
    >
      {statement.isPending ? (
        <div className="px-5 pb-5">
          <PanelSkeleton rows={6} label="Carregando extrato" />
        </div>
      ) : statement.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            title="Não conseguimos carregar o extrato"
            message={errorMessage(statement.error)}
            onRetry={() => void statement.refetch()}
          />
        </div>
      ) : (
        <div aria-busy={statement.isFetching || undefined}>
          <DataTable
            caption={`Extrato dos últimos ${periodo} dias`}
            columns={columns}
            rows={entries.slice(0, limit)}
            rowKey={(e) => e.id}
            empty={
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="Sem lançamentos no período"
              >
                Vendas recebidas, pagamentos e transferências entram aqui assim que caem na conta.
                Tente um período maior.
              </EmptyState>
            }
          />
          {entries.length > limit && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE * 2)}>
                Mostrar mais {Math.min(PAGE * 2, entries.length - limit)} de{' '}
                {entries.length - limit} lançamentos
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
