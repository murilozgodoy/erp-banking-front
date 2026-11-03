import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { dayMonth, money } from '../../lib/format'
import type { Receivable } from '../../types'
import { Button } from '../../ui/Button'
import { MoneyField } from '../../ui/Field'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'
import { ErrorState, Skeleton } from '../../ui/Surface'

import { ContractOutcome } from '../credito/ContractOutcome'
import {
  contractLabel,
  creditErrorMessage,
  creditKeys,
  errorCode,
  useContract,
  useCreditAccess,
  useSimulation,
} from '../credito/credit'
import { SimulationResult } from '../credito/SimulationResult'

/** Fração do líquido selecionado que pode ser antecipada. */
export const LIMITE_ANTECIPACAO = 0.8
const PRAZOS = [1, 2, 3, 4, 5, 6]

interface AnticipationSheetProps {
  open: boolean
  receivables: Receivable[]
  /** `reset`: proposta enviada ou seleção inválida (limpa a seleção). */
  onClose: (reset: boolean) => void
}

/** Antecipação dos recebíveis selecionados: simula, contrata e confirma no mesmo painel. */
export function AnticipationSheet({ open, receivables: atuais, onClose }: AnticipationSheetProps) {
  // Retrato da seleção ao abrir: depois de antecipar, os itens mudam de status na lista.
  const [receivables] = useState(atuais)
  const liquido = receivables.reduce((sum, r) => sum + r.valor_liquido, 0)
  const maximo = Math.floor(liquido * LIMITE_ANTECIPACAO * 100) / 100
  const [valor, setValor] = useState<number | null>(maximo)
  const [prazo, setPrazo] = useState(1)
  const queryClient = useQueryClient()
  const contract = useContract({
    onError: (error) => {
      // Algum recebível já foi antecipado: a lista precisa ser recarregada antes de nova escolha.
      if (errorCode(error) === 'RECEBIVEL_INDISPONIVEL') {
        void queryClient.invalidateQueries({ queryKey: creditKeys.receivables })
      }
    },
  })
  const done = contract.data
  const { pede, contrata } = useCreditAccess()
  const indisponivel = errorCode(contract.error) === 'RECEBIVEL_INDISPONIVEL'

  const acima = valor !== null && valor > maximo
  const invalido = valor !== null && valor <= 0
  const valido = open && pede && !done && valor !== null && !acima && !invalido
  const sim = useSimulation(
    valido
      ? {
          produto: 'ANTECIPACAO_RECEBIVEIS',
          valor,
          prazo_meses: prazo,
          receivable_ids: receivables.map((r) => r.id),
        }
      : null,
  )
  const simulation = valido ? sim.data : undefined
  // O Sheet refaz o foco quando `onClose` muda: a referência precisa ser estável.
  const latest = useRef(() => onClose(false))
  useLayoutEffect(() => {
    latest.current = () => onClose(Boolean(done))
  })
  const close = useCallback(() => latest.current(), [])
  const datas = receivables.map((r) => r.vencimento).sort()
  const n = receivables.length

  return (
    <Sheet
      open={open}
      onClose={close}
      title={done ? 'Antecipação' : 'Simular antecipação'}
      description={
        <span className="tabular">
          {n} {n === 1 ? 'recebível' : 'recebíveis'} · {money(liquido)} líquido
          {datas.length > 0 &&
            ` · ${
              datas[0] === datas[datas.length - 1]
                ? `vence ${dayMonth(datas[0])}`
                : `de ${dayMonth(datas[0])} a ${dayMonth(datas[datas.length - 1])}`
            }`}
        </span>
      }
      footer={
        done ? (
          <Button onClick={close}>Concluir</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              loading={contract.isPending}
              disabled={!simulation || sim.pending || simulation.aprovacao === 'NEGADO'}
              onClick={() => simulation && contract.mutate(simulation.id)}
            >
              {contractLabel(simulation?.aprovacao, contrata, 'Contratar', 'Enviar para análise')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <ContractOutcome request={done} />
      ) : (
        <div className="flex flex-col gap-5">
          <MoneyField
            label="Valor a antecipar"
            value={valor}
            onValueChange={setValor}
            error={
              acima
                ? `Até ${money(maximo)} (80% do líquido selecionado).`
                : invalido
                  ? 'Informe um valor maior que zero.'
                  : undefined
            }
            hint={`Até ${money(maximo)}: 80% do líquido dos recebíveis selecionados.`}
          />
          <div className="flex flex-col gap-1.5">
            <p aria-hidden className="text-sm font-medium text-ink">
              Prazo em meses
            </p>
            <Segmented
              label="Prazo em meses"
              value={String(prazo)}
              options={PRAZOS.map((p) => ({ value: String(p), label: `${p}x` }))}
              onChange={(v) => setPrazo(Number(v))}
              className="self-start"
            />
          </div>
          <div className="border-t border-line pt-5">
            {!valido ? (
              <p className="text-sm text-ink-muted">Ajuste o valor para ver as condições.</p>
            ) : sim.isError ? (
              <ErrorState
                title="Não conseguimos simular"
                message={creditErrorMessage(sim.error)}
                onRetry={() => void sim.refetch()}
              />
            ) : simulation ? (
              <SimulationResult simulation={simulation} pending={sim.pending} hero="liquido" />
            ) : (
              <div role="status" aria-label="Simulando…" className="space-y-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            )}
          </div>
          {contract.error && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-control border border-negative/25 bg-negative-soft p-4"
            >
              <p className="flex gap-2 text-sm text-ink">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />
                {creditErrorMessage(contract.error)}
              </p>
              {indisponivel && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  icon={<RotateCw aria-hidden className="size-4" />}
                  onClick={() => onClose(true)}
                >
                  Escolher de novo
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
