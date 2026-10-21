import { vi } from 'vitest'

import type { Api } from '@/services/api'

/** `Api` com todos os métodos como `vi.fn()`, para mockar o `useApi` nas páginas. */
export function fakeApi() {
  const api = {
    customers: { list: vi.fn(), get: vi.fn(), create: vi.fn(), saveAnamnesis: vi.fn() },
    scores: { strategies: vi.fn(), evaluate: vi.fn(), latest: vi.fn(), history: vi.fn() },
    accounts: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      statement: vi.fn(),
      registerTransaction: vi.fn(),
    },
    credits: { list: vi.fn(), get: vi.fn(), request: vi.fn() },
  }
  return api as typeof api & Api
}
