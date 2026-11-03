import { setupWorker } from 'msw/browser'

import { createHandlers } from './handlers'

/** Liga o MSW no navegador; o que não é do portal (backoffice) segue para as APIs reais. */
export async function startMockWorker() {
  await setupWorker(...createHandlers()).start({ onUnhandledFrame: 'bypass', quiet: true })
}
