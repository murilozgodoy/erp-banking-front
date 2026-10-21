import { describe, expect, it, vi } from 'vitest'

import { recordingAdapter } from '@/test/http'

import { createHttpClient } from './http'

describe('createHttpClient', () => {
  it('envia o access token do Auth0 em toda requisição', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-123')
    const client = createHttpClient('http://api.test', getToken)
    const { adapter, requests } = recordingAdapter()
    client.defaults.adapter = adapter

    await client.get('/customers')
    await client.post('/customers', { nome: 'Ana' })

    expect(getToken).toHaveBeenCalledTimes(2)
    expect(requests.map((r) => r.headers.Authorization)).toEqual([
      'Bearer jwt-123',
      'Bearer jwt-123',
    ])
    expect(requests[0].baseURL).toBe('http://api.test')
    expect(requests[0].timeout).toBe(1000)
  })

  it('client público não envia Authorization', async () => {
    const client = createHttpClient('http://api.test')
    const { adapter, requests } = recordingAdapter()
    client.defaults.adapter = adapter

    await client.get('/health')

    expect(requests[0].headers.Authorization).toBeUndefined()
  })

  it('não faz a requisição se o token não puder ser obtido', async () => {
    const client = createHttpClient('http://api.test', () =>
      Promise.reject(new Error('login_required')),
    )
    const { adapter, requests } = recordingAdapter()
    client.defaults.adapter = adapter

    await expect(client.get('/customers')).rejects.toThrow('login_required')
    expect(requests).toHaveLength(0)
  })
})
