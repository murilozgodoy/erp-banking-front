import { useCallback, useLayoutEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

import { dayMonth } from '../../lib/format'
import type { PortalCreditRequest } from '../../types'
import { Button } from '../../ui/Button'
import { Money } from '../../ui/Money'
import { Sheet } from '../../ui/Sheet'

import { ContractOutcome } from './ContractOutcome'
import { creditErrorMessage, taxaFracao, useConfirmCredit } from './credit'

/**
 * Contratar uma proposta que alguém com `pedir_credito` deixou AGUARDANDO_CONTRATACAO
 * (`POST /me/credit/requests/{id}/confirm`, exige `contratar_credito`): revisa e confirma.
 */
export function ConfirmRequestSheet({
  request,
  onClose,
}: {
  request: PortalCreditRequest | null
  onClose: () => void
}) {
  const confirm = useConfirmCredit()
  // O Sheet refaz o foco quando `onClose` muda: a referência precisa ser estável.
  const latest = useRef(() => {})
  useLayoutEffect(() => {
    latest.current = () => {
      confirm.reset()
      onClose()
    }
  })
  const close = useCallback(() => latest.current(), [])
  const done = confirm.data

  return (
    <Sheet
      open={request !== null}
      onClose={close}
      title={done ? 'Contratação' : 'Contratar proposta'}
      description={request ? `Proposta nº ${request.id}` : undefined}
      footer={
        done ? (
          <Button onClick={close}>Concluir</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              loading={confirm.isPending}
              onClick={() => request && confirm.mutate(request.id)}
            >
              Confirmar contratação
            </Button>
          </>
        )
      }
    >
      {done ? (
        <ContractOutcome request={done} />
      ) : (
        request && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm text-ink-muted">Valor solicitado</p>
              <Money value={request.valorSolicitado} size="xl" />
            </div>
            <dl className="divide-y divide-line border-y border-line text-sm">
              {[
                ['Prazo', request.prazoMeses === 1 ? '1 mês' : `${request.prazoMeses} meses`],
                ['Taxa', taxaFracao(request.taxaJuros)],
                ['Enviada em', dayMonth(request.criadoEm)],
                ...(request.createdByNome ? [['Feita por', request.createdByNome]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="tabular font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-muted">
              Ao confirmar, o valor líquido entra no saldo e as parcelas vão para as contas a pagar.
            </p>
            {confirm.error && (
              <p
                role="alert"
                className="flex gap-2 rounded-control border border-negative/25 bg-negative-soft p-4 text-sm text-ink"
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />
                {creditErrorMessage(confirm.error)}
              </p>
            )}
          </div>
        )
      )}
    </Sheet>
  )
}
