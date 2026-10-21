import axios, { type AxiosInstance } from 'axios'

import { env } from '@/config/env'

/** Devolve um access token válido do Auth0 (renovando-o se preciso). */
export type AccessTokenGetter = () => Promise<string>

/**
 * Cria o client HTTP de um serviço. Com `getAccessToken`, toda requisição leva o JWT
 * do usuário em `Authorization: Bearer`; sem ele, o client é público (ex.: `/health`).
 */
export function createHttpClient(
  baseURL: string,
  getAccessToken?: AccessTokenGetter,
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: env.apiTimeoutMs,
    headers: { 'Content-Type': 'application/json' },
  })
  if (getAccessToken) {
    client.interceptors.request.use(async (config) => {
      config.headers.Authorization = `Bearer ${await getAccessToken()}`
      return config
    })
  }
  return client
}
