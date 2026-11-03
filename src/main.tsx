import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { env } from '@/config/env'
import { createQueryClient } from '@/lib/queryClient'
import { router } from '@/routes'

import './index.css'

const queryClient = createQueryClient()

async function start() {
  if (env.useMocks) {
    // Carregado só com a flag: o MSW não entra no bundle principal.
    const { startMockWorker } = await import('@/portal/mocks/browser')
    await startMockWorker()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void start()
