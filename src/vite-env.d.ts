/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ONBOARDING_API_URL: string
  readonly VITE_SCORE_API_URL: string
  readonly VITE_TRANSACTIONS_API_URL: string
  readonly VITE_API_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
