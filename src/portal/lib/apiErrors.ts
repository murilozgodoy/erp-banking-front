import { isAxiosError } from 'axios'

import type { ErpApiError } from '../types'

/** 409 das rotas `/me` do Transactions enquanto o cadastro não foi aprovado. */
export function isOnboardingPendente(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 409) return false
  const body = error.response.data as Partial<ErpApiError> | undefined
  return body?.error === 'ONBOARDING_PENDENTE'
}
