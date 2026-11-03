import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import { isoDay } from '../../lib/format'
import type { PaymentRequest } from '../../types'

/** Todas sob `portalKeys.erp`: um pagamento invalida contas, histórico, extrato e saldo juntos. */
export const paymentKeys = {
  payables: [...portalKeys.erp, 'payables'] as const,
  payments: [...portalKeys.erp, 'payments'] as const,
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
