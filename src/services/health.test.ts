import { describe, expect, it } from 'vitest'

import { fakeHttp } from '@/test/http'

import { checkServicesHealth } from './health'

describe('checkServicesHealth', () => {
  it('marca online quem responde /health e offline quem falha', async () => {
    const requested: string[] = []
    const createClient = (url: string) => {
      const { http } = fakeHttp((config) => {
        requested.push(`${url}${config.url}`)
        return { status: url.includes('score') ? 503 : 200 }
      })
      return http
    }

    const result = await checkServicesHealth(createClient)

    expect(result).toEqual([
      { name: 'Onboarding API', url: 'http://onboarding.test', online: true },
      { name: 'Credit Score API', url: 'http://score.test', online: false },
      { name: 'Transactions API', url: 'http://transactions.test', online: true },
    ])
    expect(requested).toContain('http://transactions.test/health')
  })
})
