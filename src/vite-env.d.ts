/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ONBOARDING_API_URL: string
  readonly VITE_SCORE_API_URL: string
  readonly VITE_TRANSACTIONS_API_URL: string
  readonly VITE_API_TIMEOUT_MS?: string
  readonly VITE_GATEWAY_URL?: string
  readonly VITE_GRAFANA_URL?: string
  readonly VITE_PROMETHEUS_URL?: string
  readonly VITE_USE_MOCKS?: string
  readonly VITE_MOCK_AUTH?: string
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string
  readonly VITE_AUTH0_AUDIENCE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
