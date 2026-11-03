import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import type { GroupBy } from '../../types'

import type { SalesWindow } from './period'

export function salesKey(window: SalesWindow, group: GroupBy) {
  return [...portalKeys.erp, 'sales', window.from, window.to, group] as const
}

/** `GET /me/sales` de uma janela; mantém o resultado anterior enquanto troca o filtro. */
export function useSalesReport(window: SalesWindow, group: GroupBy) {
  const api = usePortalApi()
  return useQuery({
    queryKey: salesKey(window, group),
    queryFn: () => api.erp.sales({ from: window.from, to: window.to, group_by: group }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/** 409 das rotas `/me` enquanto o cadastro não foi aprovado. */
export function isOnboardingPending(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    (error.response.data as { error?: string } | undefined)?.error === 'ONBOARDING_PENDENTE'
  )
}
