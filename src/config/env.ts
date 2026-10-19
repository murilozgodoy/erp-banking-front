/**
 * Único ponto de leitura de `import.meta.env`. Falha cedo se faltar alguma URL,
 * em vez de gerar erros obscuros em runtime.
 */
function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida. Copie .env.example para .env.`)
  }
  return value.replace(/\/+$/, '')
}

export const env = {
  onboardingApiUrl: required('VITE_ONBOARDING_API_URL'),
  scoreApiUrl: required('VITE_SCORE_API_URL'),
  transactionsApiUrl: required('VITE_TRANSACTIONS_API_URL'),
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 10000),
} as const
