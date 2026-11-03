import { AlertTriangle, RotateCw } from 'lucide-react'

import { fullDate, money, pct } from '../../lib/format'
import type { Simulation } from '../../types'
import { Button } from '../../ui/Button'
import { PRODUTO_LABEL } from '../../ui/credit'
import { Money } from '../../ui/Money'
import { Sheet } from '../../ui/Sheet'

import { ContractOutcome } from './ContractOutcome'
import { creditErrorMessage, errorCode, useContract } from './credit'
import { AprovacaoPill } from './SimulationResult'

/** Erros que pedem uma simulação nova (não adianta tentar de novo a mesma). */
const PEDE_NOVA_SIMULACAO = new Set([
  'SIMULACAO_EXPIRADA',
  'SIMULACAO_JA_UTILIZADA',
  'SIMULACAO_NAO_ENCONTRADA',
])

interface ContractSheetProps {
  simulation: Simulation | null
  onClose: () => void
  /** Pede uma simulação nova (expirada ou já usada). */
  onResimulate: () => void
}

/** Confirmação da contratação: revisa as condições, envia a proposta e mostra o resultado. */
export function ContractSheet({ simulation, onClose, onResimulate }: ContractSheetProps) {
  const contract = useContract()
  const close = () => {
    contract.reset()
    onClose()
  }
  const code = contract.error ? errorCode(contract.error) : null
  const n = simulation?.parcelas.length ?? 0
  const done = contract.data

  return (
    <Sheet
      open={simulation !== null}
      onClose={close}
      title={done ? 'Contratação' : 'Confirmar contratação'}
      description={simulation ? PRODUTO_LABEL[simulation.produto] : undefined}
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
              disabled={!simulation || simulation.aprovacao === 'NEGADO'}
              onClick={() => simulation && contract.mutate(simulation.id)}
            >
              {simulation?.aprovacao === 'ANALISE'
                ? 'Enviar para análise'
                : 'Confirmar contratação'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <ContractOutcome request={done} />
      ) : (
        simulation && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-muted">Valor solicitado</p>
                <Money value={simulation.valor_solicitado} size="xl" />
              </div>
              <AprovacaoPill aprovacao={simulation.aprovacao} />
            </div>
            <dl className="divide-y divide-line border-y border-line text-sm">
              {[
                ['Valor líquido na conta', money(simulation.valor_liquido)],
                [
                  n === 1 ? 'Pagamento único' : 'Parcelas',
                  n === 1
                    ? money(simulation.parcelas[0].valor)
                    : `${n}x de ${money(simulation.parcelas[0].valor)}`,
                ],
                ['Primeiro vencimento', fullDate(simulation.parcelas[0].vencimento)],
                ['Taxa', `${pct(simulation.taxa_mensal, 2)} a.m.`],
                ['CET', `${pct(simulation.cet_anual, 2)} a.a.`],
                ['IOF', money(simulation.iof)],
                ['Total pago', money(simulation.total_pago)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="tabular font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-muted">
              {simulation.aprovacao === 'ANALISE'
                ? 'O valor passa do limite pré-aprovado: a proposta vai para o time de crédito e nada é creditado até a resposta.'
                : 'Ao confirmar, o valor líquido cai no seu saldo e as parcelas entram nas contas a pagar.'}{' '}
              Condições válidas até {fullDate(simulation.validade)}.
            </p>
            {contract.error && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-control border border-negative/25 bg-negative-soft p-4"
              >
                <p className="flex gap-2 text-sm text-ink">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />
                  {creditErrorMessage(contract.error)}
                </p>
                {code && PEDE_NOVA_SIMULACAO.has(code) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    icon={<RotateCw aria-hidden className="size-4" />}
                    onClick={() => {
                      close()
                      onResimulate()
                    }}
                  >
                    Simular de novo
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      )}
    </Sheet>
  )
}
