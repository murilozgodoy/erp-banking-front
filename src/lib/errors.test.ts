import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { errorMessage } from './errors'

function httpError(
  status: number,
  data: unknown = null,
  headers: Record<string, string> = {},
): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response = { status, data, statusText: '', headers, config } as AxiosResponse
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
    expect(errorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toMatch(
      /^Não foi possível conectar ao serviço\. Ele pode estar fora do ar ou sobrecarregado/,
    )
    expect(
      errorMessage(Object.assign(new Error('Login required'), { error: 'login_required' })),
    ).toBe('Sua sessão expirou. Entre novamente.')
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage({ error: 42 })).toBe('Erro inesperado.')
    expect(errorMessage(null)).toBe('Erro inesperado.')
  })

  it('rate limit (429), timeout e indisponibilidade do gateway', () => {
    const gateway = (detail: string) => ({ detail, request_id: 'abc' })

    expect(errorMessage(httpError(429, gateway('Too Many Requests'), { 'retry-after': '5' }))).toBe(
      'Muitas requisições em sequência. Aguarde 5 s e tente novamente.',
    )
    expect(errorMessage(httpError(429, gateway('Too Many Requests')))).toBe(
      'Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.',
    )
    expect(errorMessage(httpError(503, gateway('Service Unavailable')))).toBe(
      'Um serviço dependente está indisponível. Tente novamente em instantes.',
    )
    expect(errorMessage(httpError(504))).toBe(
      'O serviço demorou demais para responder. Tente novamente em instantes.',
    )
    expect(errorMessage(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'))).toBe(
      'O serviço demorou demais para responder. Tente novamente em instantes.',
    )
  })

  it('APIs do portal: usa a frase do corpo e traduz códigos conhecidos', () => {
    const portal = (status: number, data: unknown) =>
      new AxiosError('x', 'ERR', undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: {} as never,
      })
    expect(
      errorMessage(
        portal(400, { error: 'PARAMETRO_INVALIDO', mensagem: 'Período máximo de 400 dias' }),
      ),
    ).toBe('Período máximo de 400 dias')
    expect(
      errorMessage(portal(422, { error: 'SALDO_INSUFICIENTE', message: 'Faltam R$ 10,00' })),
    ).toBe('Faltam R$ 10,00')
    expect(errorMessage(portal(422, { error: 'SIMULACAO_EXPIRADA' }))).toMatch(/expirou/)
    expect(errorMessage(portal(422, { error: 'CODIGO_NOVO' }))).toBe(
      'Dados inválidos. Revise os campos e tente novamente.',
    )
  })
})
