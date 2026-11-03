import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { DecisionBadge } from '@/components/DecisionBadge'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Table } from '@/components/ui/Table'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from '@/lib/format'

import { RiskBadge } from './RiskBadge'

const DECISIONS_REFRESH_MS = 5000

/**
 * Decisões de crédito que chegaram ao Score pelo evento `credit.decided` (RabbitMQ):
 * a prova, na interface, de que a comunicação assíncrona Transactions → Score funcionou.
 */
export function DecisionEventsCard({ customerId }: { customerId: number }) {
  const api = useApi()
  const decisions = useQuery({
    queryKey: ['score-decisions', customerId],
    queryFn: () => api.scores.decisions(customerId),
    // O evento credit.decided chega alguns instantes depois do pedido de crédito.
    refetchInterval: DECISIONS_REFRESH_MS,
  })

  return (
    <Card
      title="Decisões registradas via evento"
      description="Recebidas pela Credit Score API no evento credit.decided (RabbitMQ)"
    >
      {decisions.isPending ? (
        <Spinner label="Carregando decisões…" />
      ) : decisions.isError ? (
        isAxiosError(decisions.error) && decisions.error.response?.status === 404 ? (
          <EmptyState>
            O histórico de eventos ainda não está disponível na Credit Score API.
          </EmptyState>
        ) : (
          <Alert tone="error">{errorMessage(decisions.error)}</Alert>
        )
      ) : decisions.data.length === 0 ? (
        <EmptyState>Nenhuma decisão recebida por evento para este cliente.</EmptyState>
      ) : (
        <Table headers={['Pedido', 'Decisão', 'Solicitado', 'Score', 'Taxa', 'Evento']}>
          {decisions.data.map((decision) => (
            <tr key={decision.event_id}>
              <td>
                <p className="font-medium">#{decision.credit_request_id}</p>
                <p className="text-xs text-ink-muted">{decision.prazo_meses} meses</p>
              </td>
              <td>
                <DecisionBadge decision={decision.status} />
                {decision.motivo && (
                  <p className="mt-1 text-xs text-ink-muted">{decision.motivo}</p>
                )}
              </td>
              <td>{formatCurrency(decision.valor_solicitado)}</td>
              <td>
                {decision.score === null ? '—' : formatNumber(decision.score, 0)}
                {decision.faixa_risco && (
                  <div className="mt-1">
                    <RiskBadge range={decision.faixa_risco} />
                  </div>
                )}
              </td>
              <td>
                {decision.taxa_juros ? `${formatPercent(decision.taxa_juros * 100)} a.m.` : '—'}
              </td>
              <td>
                <p>{formatDateTime(decision.occurred_at)}</p>
                <p className="text-xs text-ink-muted">
                  recebido {formatDateTime(decision.received_at)}
                </p>
                <p className="font-mono text-xs text-ink-faint" title={decision.event_id}>
                  {decision.event_id.slice(0, 8)}
                </p>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
