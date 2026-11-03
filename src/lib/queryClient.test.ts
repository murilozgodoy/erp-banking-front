import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { createQueryClient, retryDelay } from './queryClient'

function withStatus(status: number, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('x', 'ERR', config, null, { status, headers, config } as AxiosResponse)
}

type RetryFn = (failureCount: number, error: unknown) => boolean

describe('createQueryClient', () => {
  it('consultas: retenta erros de servidor, de rede e 429, no máximo 2 vezes', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as RetryFn

    expect(retry(0, withStatus(503))).toBe(true)
    expect(retry(0, withStatus(429))).toBe(true)
    expect(retry(0, new AxiosError('Network Error'))).toBe(true)
    expect(retry(2, withStatus(503))).toBe(false)
    expect(retry(0, withStatus(403))).toBe(false)
    expect(retry(0, withStatus(404))).toBe(false)
  })

  it('escritas: só retenta uma vez o 429', () => {
    const retry = createQueryClient().getDefaultOptions().mutations?.retry as RetryFn

    expect(retry(0, withStatus(429))).toBe(true)
    expect(retry(1, withStatus(429))).toBe(false)
    expect(retry(0, withStatus(503))).toBe(false)
    expect(retry(0, new Error('x'))).toBe(false)
  })
})

describe('retryDelay', () => {
  it('usa o Retry-After (até 10 s) ou backoff exponencial', () => {
    expect(retryDelay(0, withStatus(429, { 'retry-after': '3' }))).toBe(3000)
    expect(retryDelay(0, withStatus(429, { 'retry-after': '60' }))).toBe(10_000)
    expect(retryDelay(0, withStatus(503))).toBe(1000)
    expect(retryDelay(2, new Error('x'))).toBe(4000)
    expect(retryDelay(5, withStatus(503))).toBe(10_000)
  })
})
