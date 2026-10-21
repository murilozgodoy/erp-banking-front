import { env } from '@/config/env'

import { accountsApi } from './accounts'
import { creditsApi } from './credits'
import { customersApi } from './customers'
import { createHttpClient, type AccessTokenGetter } from './http'
import { scoresApi } from './scores'

/** Services das 3 APIs, todos autenticados com o access token do usuário. */
export function createApi(getAccessToken: AccessTokenGetter) {
  const onboarding = createHttpClient(env.onboardingApiUrl, getAccessToken)
  const score = createHttpClient(env.scoreApiUrl, getAccessToken)
  const transactions = createHttpClient(env.transactionsApiUrl, getAccessToken)

  return {
    customers: customersApi(onboarding),
    scores: scoresApi(score),
    accounts: accountsApi(transactions),
    credits: creditsApi(transactions),
  }
}

export type Api = ReturnType<typeof createApi>
