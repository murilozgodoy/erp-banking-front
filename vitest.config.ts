import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // e2e/ é do Playwright (npm run test:e2e), contra a produção.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      // Formulários longos com userEvent passam de 5 s em máquinas lentas.
      testTimeout: 20_000,
      // Valores fictícios: os testes nunca chamam as APIs nem o Auth0 de verdade.
      env: {
        VITE_ONBOARDING_API_URL: 'http://onboarding.test',
        VITE_SCORE_API_URL: 'http://score.test',
        VITE_TRANSACTIONS_API_URL: 'http://transactions.test',
        VITE_API_TIMEOUT_MS: '1000',
        VITE_GATEWAY_URL: 'http://gateway.test',
        VITE_GRAFANA_URL: 'http://grafana.test',
        VITE_PROMETHEUS_URL: 'http://prometheus.test',
        VITE_AUTH0_DOMAIN: 'test.auth0.com',
        VITE_AUTH0_CLIENT_ID: 'test-client-id',
        VITE_AUTH0_AUDIENCE: 'https://erp-banking-api',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/test/**',
          'src/portal/test/**',
          'src/portal/mocks/browser.ts',
          'src/**/*.test.{ts,tsx}',
        ],
        reporter: ['text', 'html'],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      },
    },
  }),
)
