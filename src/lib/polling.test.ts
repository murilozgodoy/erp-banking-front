import { describe, expect, it } from 'vitest'

import { EVENT_MAX_POLLS, EVENT_REFRESH_MS, pollWhileEmpty } from './polling'

const query = (data: readonly unknown[] | undefined, dataUpdateCount = 1) => ({
  state: { data, dataUpdateCount },
})

describe('pollWhileEmpty', () => {
  it('recarrega enquanto a lista está vazia', () => {
    expect(pollWhileEmpty(query([]))).toBe(EVENT_REFRESH_MS)
  })

  it('para quando chega algum item', () => {
    expect(pollWhileEmpty(query([{ id: 1 }]))).toBe(false)
  })

  it('não recarrega antes da primeira resposta nem depois do limite', () => {
    expect(pollWhileEmpty(query(undefined, 0))).toBe(false)
    expect(pollWhileEmpty(query([], EVENT_MAX_POLLS))).toBe(false)
  })
})
