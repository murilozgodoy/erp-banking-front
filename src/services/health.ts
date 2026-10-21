import { env } from '@/config/env'

import { createHttpClient } from './http'

export interface ServiceHealth {
  name: string
  url: string
  online: boolean
}

const services = [
  { name: 'Onboarding API', url: env.onboardingApiUrl },
  { name: 'Credit Score API', url: env.scoreApiUrl },
  { name: 'Transactions API', url: env.transactionsApiUrl },
]

/** `/health` é público nos 3 serviços: usa clients sem token. */
export async function checkServicesHealth(
  createClient = createHttpClient,
): Promise<ServiceHealth[]> {
  return Promise.all(
    services.map(async ({ name, url }) => {
      try {
        await createClient(url).get('/health')
        return { name, url, online: true }
      } catch {
        return { name, url, online: false }
      }
    }),
  )
}
