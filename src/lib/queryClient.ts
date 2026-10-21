import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

/** Erros 4xx (validação, permissão, não encontrado) não melhoram com retentativa. */
function isClientError(error: unknown): boolean {
  return isAxiosError(error) && error.response !== undefined && error.response.status < 500
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => failureCount < 2 && !isClientError(error),
      },
    },
  })
}
