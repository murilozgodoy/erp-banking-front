import { describe, expect, it } from 'vitest'

import vercel from '../../vercel.json'

describe('vercel.json', () => {
  it('reescreve /api/<svc>/* para o gateway na EC2 (prefixo do serviço mantido)', () => {
    const api = vercel.rewrites.filter(({ source }) => source.startsWith('/api/'))

    expect(api.map(({ source }) => source)).toEqual([
      '/api/onboarding/:path*',
      '/api/score/:path*',
      '/api/transactions/:path*',
      '/api/gateway/:path*',
    ])
    api.forEach(({ source, destination }) => {
      const service = source.split('/')[2]
      expect(destination).toMatch(/^http:\/\/[^/]+:8080\//)
      expect(destination.endsWith(`:8080/${service}/:path*`)).toBe(true)
    })
  })

  it('fallback da SPA por último, sem capturar /api nem /assets', () => {
    const fallback = vercel.rewrites.at(-1)

    expect(fallback?.destination).toBe('/index.html')
    const pattern = new RegExp(`^${fallback?.source}$`)
    expect(pattern.test('/clientes/5')).toBe(true)
    expect(pattern.test('/api/score/health')).toBe(false)
    expect(pattern.test('/assets/index.js')).toBe(false)
  })

  it('envia headers de segurança em todas as rotas', () => {
    const all = vercel.headers.find(({ source }) => source === '/(.*)')
    const keys = all?.headers.map(({ key }) => key)

    expect(keys).toEqual(
      expect.arrayContaining(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']),
    )
  })
})
