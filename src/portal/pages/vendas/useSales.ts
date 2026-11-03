import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { errorMessage } from '@/lib/errors'

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

/** Mensagem da API (`mensagem`, ex.: 400 PARAMETRO_INVALIDO) ou o texto padrão do erro. */
export function salesErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { mensagem?: unknown; message?: unknown } | undefined
    const text = data?.mensagem ?? data?.message
    if (typeof text === 'string' && text.trim()) return text
  }
  return errorMessage(error)
}
