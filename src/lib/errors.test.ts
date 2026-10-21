import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { errorMessage } from './errors'

function httpError(status: number, data: unknown = null): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, response)
}

describe('errorMessage', () => {
  it('usa o detail do FastAPI e o error do Spring', () => {
    expect(errorMessage(httpError(409, { detail: 'CPF 123 já cadastrado' }))).toBe(
      'CPF 123 já cadastrado',
    )
    expect(errorMessage(httpError(404, { error: 'Conta 9 não encontrada' }))).toBe(
      'Conta 9 não encontrada',
    )
    expect(errorMessage(httpError(502, { detail: 'Onboarding retornou 500' }))).toBe(
      'Onboarding retornou 500',
    )
  })

  it('traduz a falta de permissão e cai no padrão sem corpo', () => {
    expect(errorMessage(httpError(403, { detail: 'Missing permission: write:customers' }))).toBe(
      'Você não tem a permissão write:customers para esta ação.',
    )
    expect(errorMessage(httpError(403))).toBe('Você não tem permissão para esta ação.')
    expect(errorMessage(httpError(401))).toBe('Sua sessão expirou. Entre novamente.')
  })

  it('formata as validações do FastAPI e ignora o código genérico do Spring', () => {
    const validation = {
      detail: [
        { loc: ['body', 'cpf'], msg: 'String should have at least 11 characters' },
        { loc: ['query'], msg: 'inválido' },
        { msg: 'sem campo' },
      ],
    }
    expect(errorMessage(httpError(422, validation))).toBe(
      'cpf: String should have at least 11 characters; query: inválido; sem campo',
    )
    expect(errorMessage(httpError(400, { error: 'validation_failed' }))).toBe(
      'Dados inválidos. Revise os campos e tente novamente.',
    )
  })

  it('mensagens padrão por status', () => {
    expect(errorMessage(httpError(404))).toBe('Registro não encontrado.')
    expect(errorMessage(httpError(409))).toBe('Registro já existente.')
    expect(errorMessage(httpError(503, 'texto'))).toBe(
      'Um serviço dependente está indisponível. Tente novamente em instantes.',
    )
    expect(errorMessage(httpError(500))).toBe('Erro inesperado (HTTP 500).')
  })

  it('erro de rede, sessão do Auth0 e erros genéricos', () => {
    expect(errorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
      'Não foi possível conectar ao serviço. Verifique se ele está no ar.',
    )
    expect(
      errorMessage(Object.assign(new Error('Login required'), { error: 'login_required' })),
    ).toBe('Sua sessão expirou. Entre novamente.')
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage({ error: 42 })).toBe('Erro inesperado.')
    expect(errorMessage(null)).toBe('Erro inesperado.')
  })
})
