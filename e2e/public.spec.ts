import { expect, test } from '@playwright/test'

test.describe('páginas públicas', () => {
  test('a /login renderiza com os botões de entrar', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'ERP Banking e Crédito' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible()
  })

  for (const path of ['/clientes', '/contas', '/creditos', '/monitoramento']) {
    test(`a rota protegida ${path} redireciona para o login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    })
  }

  test('o deep link de uma rota do SPA cai no index.html (fallback), não em 404', async ({
    request,
  }) => {
    const res = await request.get('/clientes/123')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/html')
  })
})

test.describe('headers de segurança', () => {
  test('a página inicial envia os headers configurados no vercel.json', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
    const headers = res.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['strict-transport-security']).toContain('max-age=')
  })
})
