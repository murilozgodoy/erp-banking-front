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

export const env = {
  onboardingApiUrl: baseUrl('VITE_ONBOARDING_API_URL'),
  scoreApiUrl: baseUrl('VITE_SCORE_API_URL'),
  transactionsApiUrl: baseUrl('VITE_TRANSACTIONS_API_URL'),
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 10000),
  auth0: {
    domain: required('VITE_AUTH0_DOMAIN'),
    clientId: required('VITE_AUTH0_CLIENT_ID'),
    // Identifier da API no Auth0 (comparado byte a byte com o `aud` do token: não normalizar).
    audience: required('VITE_AUTH0_AUDIENCE'),
  },
} as const
