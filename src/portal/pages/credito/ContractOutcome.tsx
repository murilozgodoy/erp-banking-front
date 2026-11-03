import { motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

import { cn } from '@/lib/cn'

import { money } from '../../lib/format'
import type { PortalCreditRequest } from '../../types'
import { Money } from '../../ui/Money'
import { Pill, type Tone } from '../../ui/Pill'

import { taxaFracao } from './credit'

const REQUEST_STATUS: Record<
  PortalCreditRequest['status'],
  { label: string; tone: Tone; titulo: string; proximo: string }
> = {
  APROVADO: {
    label: 'Aprovado',
    tone: 'positive',
    titulo: 'Crédito contratado',
    proximo:
      'O valor já está no seu saldo. As parcelas aparecem em Pagamentos, nas contas a pagar.',
  },
  REVISAO: {
    label: 'Em análise',
    tone: 'warning',
    titulo: 'Proposta enviada para análise',
    proximo:
      'Nada foi debitado ou creditado ainda. Você acompanha a resposta em Propostas e contratos.',
  },
  NEGADO: {
    label: 'Não aprovado',
    tone: 'negative',
    titulo: 'Proposta não aprovada',
    proximo: 'Tente um valor menor ou um prazo maior; a simulação mostra na hora o que é possível.',
  },
}

const ICON = { APROVADO: CheckCircle2, REVISAO: Clock, NEGADO: XCircle }
const ICON_TONE = {
  APROVADO: 'bg-positive-soft text-positive',
  REVISAO: 'bg-warning-soft text-warning',
  NEGADO: 'bg-negative-soft text-negative',
}

export function RequestStatusPill({ status }: { status: PortalCreditRequest['status'] }) {
  return <Pill tone={REQUEST_STATUS[status].tone}>{REQUEST_STATUS[status].label}</Pill>
}

/** Resultado da contratação, mostrado no lugar do formulário. */
export function ContractOutcome({ request }: { request: PortalCreditRequest }) {
  const reduce = useReducedMotion()
  const info = REQUEST_STATUS[request.status]
  const Icon = ICON[request.status]
  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <span
        aria-hidden
        className={cn('grid size-11 place-items-center rounded-full', ICON_TONE[request.status])}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-lg font-semibold text-ink">{info.titulo}</p>
        {request.motivo && <p className="mt-1 text-sm text-ink-muted">{request.motivo}</p>}
      </div>
      {request.status === 'APROVADO' && request.valorAprovado !== null && (
        <div>
          <p className="text-sm text-ink-muted">Valor aprovado</p>
          <Money value={request.valorAprovado} size="xl" />
        </div>
      )}
      <dl className="divide-y divide-line border-y border-line">
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-ink-muted">Status</dt>
          <dd>
            <RequestStatusPill status={request.status} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-ink-muted">Valor solicitado</dt>
          <dd className="tabular text-sm font-medium text-ink">{money(request.valorSolicitado)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-ink-muted">Taxa contratada</dt>
          <dd className="tabular text-sm font-medium text-ink">{taxaFracao(request.taxaJuros)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-ink-muted">Proposta</dt>
          <dd className="tabular text-sm font-medium text-ink">nº {request.id}</dd>
        </div>
      </dl>
      <p className="text-sm text-ink-muted">{info.proximo}</p>
    </motion.div>
  )
}
