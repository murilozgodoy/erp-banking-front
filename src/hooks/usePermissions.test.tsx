import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { usePermissions } from './usePermissions'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('usePermissions', () => {
  it('lê as permissões do access token', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:customers'] }))
    const { result } = renderHook(() => usePermissions(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.permissions).toEqual(['read:customers'])
    expect(result.current.can('read:customers')).toBe(true)
    expect(result.current.can('write:customers')).toBe(false)
  })

  it('não busca token sem usuário logado', () => {
    const state = auth0State({ authenticated: false })
    vi.mocked(useAuth0).mockReturnValue(state)
    const { result } = renderHook(() => usePermissions(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toEqual([])
    expect(state.getAccessTokenSilently).not.toHaveBeenCalled()
  })

  it('expõe o erro quando o token não pode ser obtido', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ tokenError: new Error('consent required') }))
    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.permissions).toEqual([])
  })
})
