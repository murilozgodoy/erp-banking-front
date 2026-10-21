import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Can } from '@/components/auth/Can'
import { DecisionBadge } from '@/components/DecisionBadge'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { Table } from '@/components/ui/Table'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatNumber, humanize } from '@/lib/format'
import type { ScoreEvaluation } from '@/types/api'

import { RiskBadge } from './RiskBadge'

/** Score de crédito do cliente: vigente, cálculo (Strategy escolhida) e histórico. */
export function ScorePanel({ customerId }: { customerId: number }) {
  const api = useApi()
  const latest = useQuery({
    queryKey: ['scores', customerId, 'latest'],
    queryFn: () => api.scores.latest(customerId),
  })
  const history = useQuery({
    queryKey: ['scores', customerId, 'history'],
    queryFn: () => api.scores.history(customerId),
  })

  return (
    <Card
      title="Score de crédito"
      description="Calculado pela Credit Score API com os dados do Onboarding"
    >
      <div className="space-y-6">
        <Can permission="write:scores">
          <EvaluateScoreForm customerId={customerId} />
        </Can>

        {latest.isPending ? (
          <Spinner label="Carregando score…" />
        ) : latest.isError ? (
          <Alert tone="error">{errorMessage(latest.error)}</Alert>
        ) : latest.data ? (
          <LatestScore evaluation={latest.data} />
        ) : (
          <EmptyState>Este cliente ainda não tem score calculado.</EmptyState>
        )}

        {history.data && history.data.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Histórico de avaliações</h3>
            <Table headers={['Data', 'Strategy', 'Score', 'Faixa']}>
              {history.data.map((evaluation) => (
                <tr key={evaluation.id}>
                  <td>{formatDateTime(evaluation.created_at)}</td>
                  <td>{evaluation.strategy_usada}</td>
                  <td>{formatNumber(evaluation.score, 0)}</td>
                  <td>
                    <RiskBadge range={evaluation.faixa_risco} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </div>
    </Card>
  )
}

function LatestScore({ evaluation }: { evaluation: ScoreEvaluation }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm text-slate-500">Score vigente</p>
        <p className="text-4xl font-bold text-slate-900">
          {formatNumber(evaluation.score, 0)}
          <span className="text-base font-normal text-slate-400"> / 1000</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge range={evaluation.faixa_risco} />
          {evaluation.decision && <DecisionBadge decision={evaluation.decision.decisao} />}
        </div>
        {evaluation.decision && (
          <p className="text-sm text-slate-600">{evaluation.decision.motivo}</p>
        )}
        <p className="text-xs text-slate-500">
          Strategy {evaluation.strategy_usada} · {formatDateTime(evaluation.created_at)}
        </p>
      </div>
      {evaluation.factors.length > 0 && (
        <Table headers={['Fator', 'Peso', 'Valor']}>
          {evaluation.factors.map((factor) => (
            <tr key={factor.nome}>
              <td>{humanize(factor.nome)}</td>
              <td>{formatNumber(factor.peso, 2)}</td>
              <td>{formatNumber(factor.valor, 2)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

function EvaluateScoreForm({ customerId }: { customerId: number }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const strategies = useQuery({ queryKey: ['score-strategies'], queryFn: api.scores.strategies })
  const [selected, setSelected] = useState<string>()
  const strategy = selected ?? strategies.data?.find((s) => s.default)?.name

  const evaluate = useMutation({
    mutationFn: () => api.scores.evaluate(customerId, strategy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scores', customerId] }),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        evaluate.mutate()
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Strategy de cálculo"
          value={strategy ?? ''}
          onChange={(event) => setSelected(event.target.value)}
          disabled={!strategies.data}
          className="min-w-64 flex-1"
          hint={strategies.data?.find((s) => s.name === strategy)?.description}
        >
          {strategies.data?.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.default ? ' (padrão)' : ''}
            </option>
          ))}
        </SelectField>
        <Button type="submit" loading={evaluate.isPending} disabled={!strategy}>
          Calcular score
        </Button>
      </div>
      {strategies.isError && <Alert tone="error">{errorMessage(strategies.error)}</Alert>}
      {evaluate.isError && <Alert tone="error">{errorMessage(evaluate.error)}</Alert>}
    </form>
  )
}
