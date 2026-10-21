import type { useAuth0 } from '@auth0/auth0-react'
import { vi } from 'vitest'

/** JWT não assinado com o payload dado (o front só decodifica; quem valida são as APIs). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.assinatura`
}

interface Auth0StateOptions {
  authenticated?: boolean
  isLoading?: boolean
  permissions?: string[]
  error?: Error
  tokenError?: unknown
}

/** Valor de `useAuth0()` para os testes, com access token contendo `permissions`. */
export function auth0State({
  authenticated = true,
  isLoading = false,
  permissions = [],
  error,
  tokenError,
}: Auth0StateOptions = {}) {
  const getAccessTokenSilently = tokenError
    ? vi.fn().mockRejectedValue(tokenError)
    : vi.fn().mockResolvedValue(fakeJwt({ sub: 'auth0|tester', permissions }))

  return {
    isLoading,
    isAuthenticated: authenticated,
    error,
    user: authenticated
      ? {
          sub: 'auth0|tester',
          name: 'Maria Souza',
          given_name: 'Maria',
          email: 'maria@erp.test',
          email_verified: true,
          picture: 'https://example.com/maria.png',
        }
      : undefined,
    getAccessTokenSilently,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth0>
}
