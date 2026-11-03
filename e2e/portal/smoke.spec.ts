import { expect, test, type Page } from '@playwright/test'

import { collectErrors, openPortal } from './helpers.ts'

const ABAS = [
  { path: '/app', heading: null },
  { path: '/app/vendas', heading: 'Vendas' },
  { path: '/app/recebiveis', heading: 'Recebíveis' },
  { path: '/app/pagamentos', heading: 'Pagamentos' },
  { path: '/app/pendencias', heading: 'Pendências' },
  { path: '/app/estoque', heading: 'Estoque' },
  { path: '/app/credito', heading: 'Crédito' },
]

async function semEsqueletos(page: Page) {
  await expect(page.locator('main [role="status"][aria-label^="Carregando"]')).toHaveCount(0)
}

async function abaCarregou(page: Page, path: string, heading: string | null) {
  await expect(page).toHaveURL(new RegExp(`${path}(\\?|$)`))
  if (heading) {
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  } else {
    await expect(page.locator('main h1')).toBeVisible()
  }
  await semEsqueletos(page)
}

for (const theme of ['light', 'dark'] as const) {
  test(`todas as abas abrem sem erro de console no tema ${theme === 'light' ? 'claro' : 'escuro'}`, async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await openPortal(page, '/app')
    const nav = page.getByRole('navigation', { name: 'Portal' })
    await expect(nav).toBeVisible()

    if (theme === 'dark') {
      await page.getByRole('button', { name: 'Tema escuro' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.getByRole('button', { name: 'Tema claro' })).toBeVisible()
    }

    for (const aba of ABAS) {
      if (aba.path !== '/app') {
        await nav.getByRole('link', { name: new RegExp(`^${aba.heading}`) }).click()
      }
      await abaCarregou(page, aba.path, aba.heading)
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      }
    }
    expect(errors).toEqual([])
  })
}

test.describe('360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  for (const aba of ABAS) {
    test(`${aba.path} não rola na horizontal`, async ({ page }) => {
      const errors = collectErrors(page)
      await openPortal(page, aba.path)
      await abaCarregou(page, aba.path, aba.heading)
      // Expressão em string: o tsconfig do Node (e2e) não tem os tipos do DOM.
      const [scrollWidth, innerWidth] = await page.evaluate<[number, number]>(
        '[document.scrollingElement.scrollWidth, window.innerWidth]',
      )
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      expect(errors).toEqual([])
    })
  }
})
