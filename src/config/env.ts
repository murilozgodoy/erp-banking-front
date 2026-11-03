type EnvName =
  | 'VITE_ONBOARDING_API_URL'
  | 'VITE_SCORE_API_URL'
  | 'VITE_TRANSACTIONS_API_URL'
  | 'VITE_AUTH0_DOMAIN'
  | 'VITE_AUTH0_CLIENT_ID'
  | 'VITE_AUTH0_AUDIENCE'

/**
 * Único ponto de leitura de `import.meta.env`. Falha cedo se faltar alguma variável,
 * em vez de gerar erros obscuros em runtime.
 */
function required(name: EnvName): string {
  const value: string | undefined = import.meta.env[name]?.trim()
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida. Copie .env.example para .env.`)
  }
  return value
}

/** URLs base sem barra final, para concatenar com as rotas (`/customers`...). */
function baseUrl(name: EnvName): string {
  return required(name).replace(/\/+$/, '')
}

type OptionalEnvName = 'VITE_GATEWAY_URL' | 'VITE_GRAFANA_URL' | 'VITE_PROMETHEUS_URL'

/** URL opcional (gateway, Grafana, Prometheus): `undefined` quando não configurada. */
function optionalUrl(name: OptionalEnvName): string | undefined {
  const value = import.meta.env[name]?.trim().replace(/\/+$/, '')
  return value || undefined
}

/** Número positivo da variável, ou o padrão se ela estiver vazia/inválida (evita timeout 0 = infinito). */
function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  onboardingApiUrl: baseUrl('VITE_ONBOARDING_API_URL'),
  scoreApiUrl: baseUrl('VITE_SCORE_API_URL'),
  transactionsApiUrl: baseUrl('VITE_TRANSACTIONS_API_URL'),
  /** Base do API Gateway (`http://localhost:8080` local, `/api` na Vercel). */
  gatewayUrl: optionalUrl('VITE_GATEWAY_URL'),
  grafanaUrl: optionalUrl('VITE_GRAFANA_URL'),
  prometheusUrl: optionalUrl('VITE_PROMETHEUS_URL'),
  /** Portal contra os mocks MSW (contratos de PORTAL_CLIENTE.md) enquanto as rotas /me não sobem. */
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  apiTimeoutMs: positiveNumber(import.meta.env.VITE_API_TIMEOUT_MS, 10_000),
  auth0: {
    domain: required('VITE_AUTH0_DOMAIN'),
    clientId: required('VITE_AUTH0_CLIENT_ID'),
    // Identifier da API no Auth0 (comparado byte a byte com o `aud` do token: não normalizar).
    audience: required('VITE_AUTH0_AUDIENCE'),
  },
} as const
