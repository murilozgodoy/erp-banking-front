import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { createQueryClient } from './queryClient'

function withStatus(status: number) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('x', 'ERR', config, null, { status, config } as AxiosResponse)
}

describe('createQueryClient', () => {
  it('retenta só erros de servidor ou de rede, no máximo 2 vezes', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean

    expect(retry(0, withStatus(503))).toBe(true)
    expect(retry(0, new AxiosError('Network Error'))).toBe(true)
    expect(retry(2, withStatus(503))).toBe(false)
    expect(retry(0, withStatus(403))).toBe(false)
    expect(retry(0, withStatus(404))).toBe(false)
  })
})
