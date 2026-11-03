import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { isAuth0SessionError, retryAfterSeconds } from './errors'

/**
 * Erros 4xx (validação, permissão, não encontrado) não melhoram com retentativa; a exceção
 * é o 429 do rate limit do gateway, que passa depois de alguns segundos.
 */
function isClientError(error: unknown): boolean {
  if (isAuth0SessionError(error)) return true
  if (!isAxiosError(error) || error.response === undefined) return false
  const { status } = error.response
  return status < 500 && status !== 429
}

function isRateLimited(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 429
}

/** Respeita o `Retry-After` do gateway (até 10 s); senão, backoff exponencial 1 s, 2 s, 4 s... */
export function retryDelay(failureCount: number, error: unknown): number {
  const seconds = retryAfterSeconds(error)
  if (seconds) return Math.min(seconds, 10) * 1000
  return Math.min(1000 * 2 ** failureCount, 10_000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => failureCount < 2 && !isClientError(error),
        retryDelay,
      },
      mutations: {
        // Escritas não são idempotentes: só retenta o 429, que o gateway rejeita sem
        // repassar ao serviço.
        retry: (failureCount, error) => failureCount < 1 && isRateLimited(error),
        retryDelay,
      },
    },
  })
}
