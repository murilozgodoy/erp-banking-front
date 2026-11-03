import { expect, test } from '@playwright/test'

/** Rewrites /api/* do vercel.json → API Gateway na EC2. */
test.describe('APIs via rewrite da Vercel', () => {
  for (const path of [
    '/api/gateway/health',
    '/api/onboarding/health',
    '/api/score/health',
    '/api/transactions/health',
  ]) {
    test(`GET ${path} responde 200 em JSON`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('application/json')
    })
  }

  test('rotas protegidas exigem token (401) e o actuator não é exposto', async ({ request }) => {
    expect((await request.get('/api/transactions/accounts')).status()).toBe(401)
    expect((await request.get('/api/onboarding/customers')).status()).toBe(401)
    expect((await request.get('/api/score/scores/strategies')).status()).toBe(401)
    expect((await request.get('/api/transactions/actuator/prometheus')).status()).toBe(404)
  })
})

test.describe('Swagger do Transactions pela Vercel', () => {
  test('o api-docs usa server relativo (funciona com https atrás da Vercel)', async ({
    request,
  }) => {
    const res = await request.get('/api/transactions/v3/api-docs')
    expect(res.status()).toBe(200)
    const docs = await res.json()
    expect(docs.info.title).toBe('ERP Banking - Transactions API')
    expect(docs.servers[0].url).toBe('..')
  })

  test('a Swagger UI abre e lista as operações', async ({ page }) => {
    await page.goto('/api/transactions/swagger-ui/index.html')
    await expect(
      page.getByRole('heading', { name: /ERP Banking - Transactions API/ }),
    ).toBeVisible()
    await expect(
      page.locator('.opblock-summary-path', { hasText: '/credits' }).first(),
    ).toBeVisible()
    await expect(page.getByText('Failed to load API definition')).toHaveCount(0)
  })
})

/** Só roda com E2E_ACCESS_TOKEN (JWT do Auth0, copiado de /perfil); sem ele, os testes são pulados. */
test.describe('autenticado (E2E_ACCESS_TOKEN)', () => {
  const token = process.env.E2E_ACCESS_TOKEN
  test.skip(!token, 'E2E_ACCESS_TOKEN não definido')

  const auth = () => ({ Authorization: `Bearer ${token}` })

  test('lista clientes, contas, créditos e strategies com o token', async ({ request }) => {
    for (const path of [
      '/api/onboarding/customers?limit=1',
      '/api/transactions/accounts',
      '/api/transactions/credits',
      '/api/score/scores/strategies',
    ]) {
      const res = await request.get(path, { headers: auth() })
      expect(res.status(), path).toBe(200)
    }
  })
})
