import { setupServer } from 'msw/node'

import { createHandlers } from './handlers'

/** Servidor MSW para os testes (Vitest). */
export const mockServer = setupServer(...createHandlers())
