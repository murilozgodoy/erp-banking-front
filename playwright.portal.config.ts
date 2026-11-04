import { defineConfig, devices } from '@playwright/test'

const PORT = 5190

/**
 * E2E do portal do cliente (/app) contra o Vite local em modo mock: MSW no navegador e login
 * simulado (`?perfil=cliente`, `?mock=<status>`). Nada de Auth0 nem APIs reais.
 * Rode com `npm run test:e2e:portal` ou pelo workflow manual "E2E portal".
 * As variáveis vão pelo `webServer.env`: não crie um .env (ele vaza VITE_MOCK_AUTH para o vitest).
 */
export default defineConfig({
  testDir: './e2e/portal',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Mais workers disputam o Vite (dev, sem build) e estouram os timeouts no primeiro acesso.
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_USE_MOCKS: 'true',
      VITE_MOCK_AUTH: 'true',
      // Obrigatórias no env.ts; com mocks e login simulado nunca são chamadas.
      VITE_ONBOARDING_API_URL: 'http://localhost:8080/onboarding',
      VITE_SCORE_API_URL: 'http://localhost:8080/score',
      VITE_TRANSACTIONS_API_URL: 'http://localhost:8080/transactions',
      VITE_AUTH0_DOMAIN: 'mock.auth0.local',
      VITE_AUTH0_CLIENT_ID: 'mock-client-id',
      VITE_AUTH0_AUDIENCE: 'https://erp-banking-api',
      VITE_GATEWAY_URL: '',
      VITE_GRAFANA_URL: '',
      VITE_PROMETHEUS_URL: '',
    },
  },
})
