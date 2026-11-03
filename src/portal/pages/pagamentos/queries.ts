import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import { isoDay } from '../../lib/format'
import type { PaymentRequest } from '../../types'

/** Todas sob `portalKeys.erp`: um pagamento invalida contas, histórico, extrato e saldo juntos. */
export const paymentKeys = {
  payables: [...portalKeys.erp, 'payables'] as const,
  payments: [...portalKeys.erp, 'payments'] as const,
  pending: [...portalKeys.erp, 'payments', 'pending'] as const,
  statement: (days: number) => [...portalKeys.erp, 'statement', days] as const,
}

/** Todas as contas (o filtro por status é local: os totais e as contagens vêm da mesma lista). */
export function usePayables() {
  const api = usePortalApi()
  return useQuery({ queryKey: paymentKeys.payables, queryFn: () => api.erp.payables() })
}

export function usePaymentHistory() {
  const api = usePortalApi()
  return useQuery({ queryKey: paymentKeys.payments, queryFn: api.erp.payments })
}

export function useStatement(days: number) {
  const api = usePortalApi()
  return useQuery({
    queryKey: paymentKeys.statement(days),
    queryFn: () => {
      const from = new Date()
      from.setDate(from.getDate() - days)
      return api.erp.statement({ from: isoDay(from), to: isoDay(new Date()) })
    },
    placeholderData: (previous) => previous,
  })
}

export function usePay() {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: portalKeys.erp }),
      queryClient.invalidateQueries({ queryKey: portalKeys.overview }),
    ])
  const mutation = useMutation({
    mutationFn: (payment: PaymentRequest) => api.erp.pay(payment),
    onSuccess: refresh,
  })
  return { ...mutation, refresh }
}

/** Pagamentos acima do limite de alguém, esperando aprovação (`aprovar_pagamentos`). */
export function usePendingPayments(enabled: boolean) {
  const api = usePortalApi()
  return useQuery({ queryKey: paymentKeys.pending, queryFn: api.erp.pendingPayments, enabled })
}

/** Aprovar ou rejeitar: os dois atualizam a bandeja, saldo, contas, histórico e extrato. */
function useRefreshErp() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: portalKeys.erp }),
      queryClient.invalidateQueries({ queryKey: portalKeys.overview }),
    ])
}

/** Aprovar executa o débito (ou agenda) e devolve o comprovante, como o `POST /me/payments`. */
export function useApprovePayment() {
  const api = usePortalApi()
  const refresh = useRefreshErp()
  return useMutation({
    mutationFn: (id: number) => api.erp.approvePayment(id),
    onSettled: refresh,
  })
}

/** Rejeitar não move dinheiro; o motivo é opcional. */
export function useRejectPayment() {
  const api = usePortalApi()
  const refresh = useRefreshErp()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      api.erp.rejectPayment(id, motivo),
    onSettled: refresh,
  })
}
