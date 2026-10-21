import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createApi } from '@/services/api'

import { useApi } from './useApi'

const getAccessTokenSilently = vi.fn().mockResolvedValue('jwt')

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently }),
}))
vi.mock('@/services/api', () => ({
  createApi: vi.fn(() => ({ customers: {} })),
}))

describe('useApi', () => {
  it('cria os services uma vez, usando o token do Auth0', async () => {
    const { result, rerender } = renderHook(() => useApi())
    const first = result.current
    rerender()

    expect(result.current).toBe(first)
    expect(createApi).toHaveBeenCalledTimes(1)

    const getToken = vi.mocked(createApi).mock.calls[0][0]
    await expect(getToken()).resolves.toBe('jwt')
    expect(getAccessTokenSilently).toHaveBeenCalled()

    getAccessTokenSilently.mockResolvedValueOnce(undefined)
    await expect(getToken()).rejects.toThrow('Access token indisponível')
  })
})
