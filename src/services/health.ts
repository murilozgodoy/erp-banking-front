import { onboardingApi, scoreApi, transactionsApi } from './http'

export interface ServiceHealth {
  name: string
  url: string
  online: boolean
}

const services = [
  { name: 'Onboarding API', client: onboardingApi },
  { name: 'Credit Score API', client: scoreApi },
  { name: 'Transactions API', client: transactionsApi },
]

export async function checkServicesHealth(): Promise<ServiceHealth[]> {
  return Promise.all(
    services.map(async ({ name, client }) => {
      const url = client.defaults.baseURL ?? ''
      try {
        await client.get('/health')
        return { name, url, online: true }
      } catch {
        return { name, url, online: false }
      }
    }),
  )
}
