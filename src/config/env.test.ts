import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('lê as variáveis, removendo a barra final só das URLs', async () => {
    vi.stubEnv('VITE_SCORE_API_URL', 'http://score.test//')
    vi.stubEnv('VITE_AUTH0_AUDIENCE', 'https://erp-banking-api/')
    const { env } = await import('./env')

    expect(env.scoreApiUrl).toBe('http://score.test')
    expect(env.auth0.audience).toBe('https://erp-banking-api/')
    expect(env.apiTimeoutMs).toBe(1000)
  })

  it('falha cedo quando falta uma variável obrigatória', async () => {
    vi.stubEnv('VITE_AUTH0_AUDIENCE', '  ')

    await expect(import('./env')).rejects.toThrow('VITE_AUTH0_AUDIENCE não definida')
  })
})
