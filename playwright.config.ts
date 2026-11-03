import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra o front publicado (Vercel), sem servidor local.
 * BASE_URL sobrescreve o alvo; E2E_ACCESS_TOKEN habilita os testes autenticados da API.
 * Fora do CI obrigatório: rode com `npm run test:e2e` ou pelo workflow manual "E2E".
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'https://erp-banking-front.vercel.app',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
