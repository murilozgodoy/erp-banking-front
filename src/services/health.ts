import { env } from '@/config/env'

import { createHttpClient } from './http'

export interface ServiceHealth {
  name: string
  url: string
  online: boolean
  /** Tempo de resposta do health check, em milissegundos. */
  latencyMs?: number
}

interface HealthTarget {
  name: string
  url: string
  path: string
}

/** Os 3 serviços e, se `VITE_GATEWAY_URL` estiver definida, o próprio API Gateway. */
function targets(): HealthTarget[] {
  const list: HealthTarget[] = [
    { name: 'Onboarding API', url: env.onboardingApiUrl, path: '/health' },
    { name: 'Credit Score API', url: env.scoreApiUrl, path: '/health' },
    { name: 'Transactions API', url: env.transactionsApiUrl, path: '/health' },
  ]
  if (env.gatewayUrl) {
    list.push({ name: 'API Gateway', url: env.gatewayUrl, path: '/gateway/health' })
  }
  return list
}

/** `/health` é público nos 3 serviços e no gateway: usa clients sem token. */
export async function checkServicesHealth(
  createClient = createHttpClient,
): Promise<ServiceHealth[]> {
  return Promise.all(
    targets().map(async ({ name, url, path }) => {
      const start = performance.now()
      try {
        await createClient(url).get(path)
        return { name, url, online: true, latencyMs: Math.round(performance.now() - start) }
      } catch {
        return { name, url, online: false }
      }
    }),
  )
}
