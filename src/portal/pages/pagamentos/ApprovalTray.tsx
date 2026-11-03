import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Check } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { errorMessage } from '@/lib/errors'

import { dayMonth, isoDay, money } from '../../lib/format'
import { useMembro } from '../../team/useMembro'
import type { Payment, PaymentResponse } from '../../types'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Money } from '../../ui/Money'
import { Sheet } from '../../ui/Sheet'
import { ErrorState, Panel } from '../../ui/Surface'
import { decisionFailure, TIPO_LABEL } from './model'
import { ReceiptStep } from './PaymentSheet'
import { RowsSkeleton } from './RowsSkeleton'
import { useApprovePayment, usePendingPayments, useRejectPayment } from './queries'

/** O membro logado é o autor? Sem nome no `/me`, quem decide é o back (403 motivo AUTOR). */
function isOwn(payment: Payment, nome: string | undefined): boolean {
  return Boolean(nome && payment.created_by_nome && payment.created_by_nome === nome)
}

/** Comprovante do pagamento recém-aprovado (a resposta do approve tem o mesmo formato). */
function ApprovedReceipt({
  result,
  onClose,
}: {
  result: PaymentResponse | null
  onClose: () => void
}) {
  const heading = useRef<HTMLDivElement>(null)
  return (
    <Sheet
      open={result !== null}
      onClose={onClose}
      title="Pagamento aprovado"
      description={result ? `${TIPO_LABEL[result.comprovante.tipo]} · aprovado agora` : undefined}
      footer={<Button onClick={onClose}>Concluir</Button>}
    >
      {result && <ReceiptStep headingRef={heading} result={result} />}
    </Sheet>
  )
}

/**
 * Bandeja "Aguardando aprovação" (seção 11), no topo de Pagamentos para quem tem
 * `aprovar_pagamentos`: valor, destinatário, quem fez e quando, com Aprovar e Rejeitar (com
 * confirmação e motivo opcional). Aprovar mostra o comprovante. Sem pendências, não ocupa espaço.
 */
export function ApprovalTray() {
  const { pode, membro } = useMembro()
  const enabled = pode('aprovar_pagamentos')
  const pending = usePendingPayments(enabled)
  const approve = useApprovePayment()
  const reject = useRejectPayment()
  const reduce = useReducedMotion()
  const [confirming, setConfirming] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PaymentResponse | null>(null)
  const closeReceipt = useCallback(() => setReceipt(null), [])

  if (!enabled) return null
  const items = pending.data ?? []
  const busy = approve.isPending || reject.isPending
  const receiptSheet = <ApprovedReceipt result={receipt} onClose={closeReceipt} />
  if (pending.isSuccess && items.length === 0 && !feedback) return receiptSheet

  const start = () => {
    setRowError(null)
    setFeedback(null)
  }

  const doApprove = (payment: Payment) => {
    start()
    approve.mutate(payment.id, {
      onSuccess: (result) => {
        setFeedback(
          result.status === 'AGENDADO'
            ? `Pagamento de ${money(payment.valor)} para ${payment.destinatario} aprovado e agendado.`
            : `Pagamento de ${money(payment.valor)} para ${payment.destinatario} aprovado e debitado.`,
        )
        setReceipt(result)
      },
      onError: (error) => setRowError({ id: payment.id, text: decisionFailure(error) }),
    })
  }

  const doReject = (payment: Payment) => {
    start()
    reject.mutate(
      { id: payment.id, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          setConfirming(null)
          setMotivo('')
          setFeedback(
            `Pagamento de ${money(payment.valor)} para ${payment.destinatario} rejeitado. Nada foi debitado.`,
          )
        },
        onError: (error) => {
          setConfirming(null)
          setRowError({ id: payment.id, text: decisionFailure(error) })
        },
      },
    )
  }

  return (
    <>
      <Panel
        id="aprovacao"
        title={
          <span className="flex items-center gap-2">
            Aguardando aprovação
            {items.length > 0 && (
              <span className="tabular rounded-full bg-warning-soft px-2 text-xs leading-5 font-semibold text-warning">
                {items.length}
              </span>
            )}
          </span>
        }
        description="Pagamentos acima do limite de quem fez. Aprovar debita na hora; rejeitar não move dinheiro."
        flush
      >
        <div aria-live="polite">
          {feedback && (
            <p className="mx-5 mb-3 flex items-center gap-2 rounded-control bg-positive-soft px-3 py-2 text-sm text-ink">
              <Check aria-hidden className="size-4 shrink-0 text-positive" />
              {feedback}
            </p>
          )}
        </div>
        {pending.isPending ? (
          <RowsSkeleton rows={2} label="Carregando pagamentos aguardando aprovação" />
        ) : pending.isError ? (
          <div className="px-5 pb-5">
            <ErrorState
              title="Não conseguimos carregar os pagamentos para aprovar"
              message={errorMessage(pending.error)}
              onRetry={() => void pending.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">
            Nada mais aguardando aprovação.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            <AnimatePresence initial={false}>
              {items.map((p) => {
                const own = isOwn(p, membro?.nome)
                const error = rowError?.id === p.id ? rowError.text : null
                const rejecting = confirming === p.id
                return (
                  <motion.li
                    key={p.id}
                    layout={!reduce}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="px-5 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-3 sm:justify-start">
                          <span className="truncate text-sm font-medium text-ink">
                            {p.destinatario}
                          </span>
                          <Money value={p.valor} size="sm" className="shrink-0 sm:hidden" />
                        </p>
                        <p className="text-xs text-ink-muted">
                          {TIPO_LABEL[p.tipo]} · {dayMonth(isoDay(new Date(p.criado_em)))}
                          {p.agendado_para ? ` · para ${dayMonth(p.agendado_para)}` : ''}
                          {p.created_by_nome && (
                            <span className="text-ink-faint">
                              {' '}
                              · feito por {own ? 'você' : p.created_by_nome}
                            </span>
                          )}
                        </p>
                      </div>
                      <Money value={p.valor} size="sm" className="hidden shrink-0 sm:block" />
                      {own ? (
                        <p className="w-full text-xs text-ink-muted sm:w-auto">
                          Você enviou: outra pessoa precisa aprovar
                        </p>
                      ) : (
                        !rejecting && (
                          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                start()
                                setMotivo('')
                                setConfirming(p.id)
                              }}
                              aria-label={`Rejeitar pagamento de ${money(p.valor)} para ${p.destinatario}`}
                            >
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              loading={approve.isPending && approve.variables === p.id}
                              disabled={busy && approve.variables !== p.id}
                              onClick={() => doApprove(p)}
                              aria-label={`Aprovar pagamento de ${money(p.valor)} para ${p.destinatario}`}
                            >
                              Aprovar
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                    {rejecting && (
                      <form
                        aria-label={`Rejeitar pagamento para ${p.destinatario}`}
                        onSubmit={(event) => {
                          event.preventDefault()
                          doReject(p)
                        }}
                        className="mt-3 flex flex-col gap-3 rounded-control bg-sunken p-3 sm:flex-row sm:items-end"
                      >
                        <TextField
                          label="Motivo (opcional)"
                          autoComplete="off"
                          maxLength={200}
                          value={motivo}
                          onChange={(event) => setMotivo(event.currentTarget.value)}
                          hint="Quem fez o pagamento vê o motivo no histórico."
                          className="min-w-0 flex-1"
                        />
                        <div className="flex items-center justify-end gap-2 sm:pb-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirming(null)}
                            disabled={reject.isPending}
                          >
                            Manter
                          </Button>
                          <Button
                            type="submit"
                            variant="danger"
                            size="sm"
                            loading={reject.isPending}
                          >
                            Rejeitar pagamento
                          </Button>
                        </div>
                      </form>
                    )}
                    {error && (
                      <p
                        role="alert"
                        className="mt-2 flex gap-2 rounded-control bg-negative-soft px-3 py-2 text-sm text-ink"
                      >
                        <AlertTriangle
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-negative"
                        />
                        {error}
                      </p>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
      {receiptSheet}
    </>
  )
}
