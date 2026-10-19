import axios, { type AxiosInstance } from 'axios'

import { env } from '@/config/env'

/** Cria um client HTTP para um serviço. Na Etapa 3 o interceptor injetará o JWT do Auth0. */
function createClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: env.apiTimeoutMs,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onboardingApi = createClient(env.onboardingApiUrl)
export const scoreApi = createClient(env.scoreApiUrl)
export const transactionsApi = createClient(env.transactionsApiUrl)
