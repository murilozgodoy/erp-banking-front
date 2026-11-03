import { isAxiosError } from 'axios'

const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.'
const TIMEOUT = 'O serviço demorou demais para responder. Tente novamente em instantes.'
const UNAVAILABLE = 'Um serviço dependente está indisponível. Tente novamente em instantes.'

/** Textos genéricos do gateway (nginx), que não valem a pena mostrar crus. */
const GATEWAY_DETAILS = new Set(['Too Many Requests', 'Service Unavailable', 'Bad Gateway'])

/** Segundos do header `Retry-After` (429/503), se presente e numérico. */
export function retryAfterSeconds(error: unknown): number | undefined {
  if (!isAxiosError(error) || !error.response) return undefined
  const headers = error.response.headers as Record<string, unknown> | undefined
  const value = Number(headers?.['retry-after'])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Códigos de erro do Auth0 SDK que significam "precisa logar de novo". */
const AUTH0_SESSION_ERRORS = new Set([
  'login_required',
  'consent_required',
  'missing_refresh_token',
  'invalid_grant',
])

/** Mensagem em português para exibir ao usuário a partir de um erro das APIs ou do Auth0. */
export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return TIMEOUT
      // Em dev, os 429/503 gerados pelo próprio gateway chegam sem CORS e o navegador
      // os reporta como erro de rede: a mensagem cobre os dois casos.
      return 'Não foi possível conectar ao serviço. Ele pode estar fora do ar ou sobrecarregado; tente novamente em instantes.'
    }
    const { status, data } = error.response
    const detail = apiDetail(data)
    switch (status) {
      case 429: {
        const seconds = retryAfterSeconds(error)
        return `Muitas requisições em sequência. Aguarde ${
          seconds ? `${seconds} s` : 'alguns segundos'
        } e tente novamente.`
      }
      case 504:
        return TIMEOUT
      case 400:
      case 422:
        return detail ?? 'Dados inválidos. Revise os campos e tente novamente.'
      case 401:
        return SESSION_EXPIRED
      case 403:
        return detail ?? 'Você não tem permissão para esta ação.'
      case 404:
        return detail ?? 'Registro não encontrado.'
      case 409:
        return detail ?? 'Registro já existente.'
      case 502:
      case 503:
        return detail ?? UNAVAILABLE
      default:
        return detail ?? `Erro inesperado (HTTP ${status}).`
    }
  }
  if (isAuth0SessionError(error)) return SESSION_EXPIRED
  if (error instanceof Error && error.message) return error.message
  return 'Erro inesperado.'
}

export function isAuth0SessionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('error' in error)) return false
  const code = (error as { error: unknown }).error
  return typeof code === 'string' && AUTH0_SESSION_ERRORS.has(code)
}

/**
 * Extrai a mensagem do corpo de erro: FastAPI usa `{ detail }` (texto ou lista de
 * validações) e o Spring usa `{ error }`.
 */
function apiDetail(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const { detail, error } = data as { detail?: unknown; error?: unknown }

  if (typeof detail === 'string') {
    return GATEWAY_DETAILS.has(detail) ? undefined : translate(detail)
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = item.loc?.filter((part) => part !== 'body').join('.')
        return field ? `${field}: ${item.msg}` : item.msg
      })
      .join('; ')
  }
  if (typeof error === 'string' && error !== 'validation_failed') return error
  return undefined
}

function translate(detail: string): string {
  const missing = /^Missing permission: (.+)$/.exec(detail)
  if (missing) return `Você não tem a permissão ${missing[1]} para esta ação.`
  return detail
}
