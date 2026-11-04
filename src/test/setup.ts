import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import axios from 'axios'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom aplica CORS ao XHR; com o adapter fetch (Node) os testes falam com o MSW como o navegador
// real fala com o gateway (mesma origem).
axios.defaults.adapter = 'fetch'

/**
 * Relógio fixo: todo teste começa em 03/11/2026 às 15:00 (Brasília) e o tempo corre normalmente a
 * partir daí. Os mocks montam datas relativas a "agora" ("há 2 dias", "expira em 5 dias"), que
 * mudavam perto da meia-noite e quebravam a suíte conforme a hora do CI.
 */
export const AGORA_DOS_TESTES = new Date('2026-11-03T15:00:00-03:00')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(AGORA_DOS_TESTES)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})
