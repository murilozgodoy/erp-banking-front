import { isAxiosError } from 'axios'

import type { Permissao } from '../types'

import { PERMISSAO_INFO } from './permissions'

/**
 * Permissão que faltou num 403 `{"error":"SEM_PERMISSAO","permissao":"…"}` (seção 11). Além das
 * oito da equipe, o onboarding responde `"dono"` (só o dono edita o cadastro).
 */
export function permissaoNegada(error: unknown): Permissao | 'dono' | null {
  if (!isAxiosError(error) || error.response?.status !== 403) return null
  const body = error.response.data as { error?: unknown; permissao?: unknown } | undefined
  if (body?.error !== 'SEM_PERMISSAO') return null
  const permissao = String(body.permissao ?? '')
  if (permissao === 'dono') return 'dono'
  return permissao in PERMISSAO_INFO ? (permissao as Permissao) : 'ver_financeiro'
}

/** Texto do 403 de permissão: o problema e com quem resolver. */
export function mensagemSemPermissao(permissao: Permissao | 'dono'): string {
  if (permissao === 'dono') {
    return 'Só o dono da empresa pode fazer isto. Peça a ele para fazer a alteração.'
  }
  return `Seu acesso não permite ${PERMISSAO_INFO[permissao].acao}. Peça essa permissão a um administrador da empresa; quando ele liberar, é só tentar de novo.`
}

/** Mensagem amigável se o erro for um 403 de permissão; `null` para os demais. */
export function mensagemDoErroDePermissao(error: unknown): string | null {
  const permissao = permissaoNegada(error)
  return permissao ? mensagemSemPermissao(permissao) : null
}
