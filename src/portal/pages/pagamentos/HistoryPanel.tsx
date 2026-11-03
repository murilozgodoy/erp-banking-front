import { History } from 'lucide-react'
import { useState } from 'react'

import { errorMessage } from '@/lib/errors'

import { dayMonth, isoDay } from '../../lib/format'
import type { Payment } from '../../types'
import { Button } from '../../ui/Button'
import { Money } from '../../ui/Money'
import { Pill, type Tone } from '../../ui/Pill'
import { EmptyState, ErrorState, Panel } from '../../ui/Surface'
import { RowsSkeleton } from './RowsSkeleton'
import { TIPO_LABEL } from './model'
import { usePaymentHistory } from './queries'

const PAGE = 8

const STATUS: Record<Payment['status'], { label: string; tone: Tone }> = {
  EFETIVADO: { label: 'Efetivado', tone: 'positive' },
  AGENDADO: { label: 'Agendado', tone: 'info' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
}

/** Pagamentos feitos pela conta PJ (portal e ERP), do mais recente ao mais antigo. */
export function HistoryPanel({ onNew }: { onNew: () => void }) {
  const history = usePaymentHistory()
  const [limit, setLimit] = useState(PAGE)
  const items = history.data ?? []

  return (
    <Panel id="historico" title="Histórico de pagamentos" flush>
      {history.isPending ? (
        <RowsSkeleton rows={4} label="Carregando histórico de pagamentos" />
      ) : history.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            title="Não conseguimos carregar o histórico"
            message={errorMessage(history.error)}
            onRetry={() => void history.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="Nenhum pagamento ainda"
          action={
            <Button variant="secondary" size="sm" onClick={onNew}>
              Fazer o primeiro pagamento
            </Button>
          }
        >
          Cada PIX, boleto ou TED pago pela conta fica registrado aqui com a autenticação do
          comprovante.
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-line border-t border-line">
            {items.slice(0, limit).map((p) => {
              const status = STATUS[p.status]
              return (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.destinatario}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {TIPO_LABEL[p.tipo]} · {dayMonth(isoDay(new Date(p.criado_em)))}
                      {p.descricao ? ` · ${p.descricao}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Money value={p.valor} size="sm" />
                    <Pill tone={status.tone}>
                      {p.status === 'AGENDADO' && p.agendado_para
                        ? `Agendado ${dayMonth(p.agendado_para)}`
                        : status.label}
                    </Pill>
                  </div>
                </li>
              )
            })}
          </ul>
          {items.length > limit && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE * 2)}>
                Mostrar mais pagamentos
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
