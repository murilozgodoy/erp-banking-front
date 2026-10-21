import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Valores fictícios: os testes nunca chamam as APIs nem o Auth0 de verdade.
      env: {
        VITE_ONBOARDING_API_URL: 'http://onboarding.test',
        VITE_SCORE_API_URL: 'http://score.test',
        VITE_TRANSACTIONS_API_URL: 'http://transactions.test',
        VITE_API_TIMEOUT_MS: '1000',
        VITE_AUTH0_DOMAIN: 'test.auth0.com',
        VITE_AUTH0_CLIENT_ID: 'test-client-id',
        VITE_AUTH0_AUDIENCE: 'https://erp-banking-api',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
        reporter: ['text', 'html'],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      },
    },
  }),
)
