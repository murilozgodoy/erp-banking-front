import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'

export interface FakeResponse {
  status?: number
  data?: unknown
}

/**
 * Adapter do axios que não faz rede: grava cada requisição e responde com `respond`.
 * Status >= 400 vira `AxiosError`, como nos adapters reais.
 */
export function recordingAdapter(
  respond: (config: InternalAxiosRequestConfig) => FakeResponse = () => ({}),
) {
  const requests: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config)
    const { status = 200, data = null } = respond(config)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) {
      throw new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response)
    }
    return response
  }
  return { adapter, requests }
}

/** Instância axios com adapter falso, para testar os services. */
export function fakeHttp(respond?: (config: InternalAxiosRequestConfig) => FakeResponse) {
  const { adapter, requests } = recordingAdapter(respond)
  return { http: axios.create({ adapter }), requests }
}

/** Corpo JSON enviado numa requisição gravada. */
export function body(config: InternalAxiosRequestConfig): unknown {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data
}
