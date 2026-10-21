import { describe, expect, it, vi } from 'vitest'

import { body, fakeHttp } from '@/test/http'

import { accountsApi } from './accounts'
import { createApi } from './api'
import { creditsApi } from './credits'
import { customersApi } from './customers'
import { scoresApi } from './scores'

describe('customersApi', () => {
  it('lista, consulta, cria e grava a anamnese', async () => {
    const { http, requests } = fakeHttp(() => ({ data: { id: 1 } }))
    const api = customersApi(http)

    await api.list({ q: 'ana', limit: 10 })
    await api.list()
    await api.get(7)
    await api.create({ nome: 'Ana', cpf: '1', email: 'a@a.com', telefone: '1' })
    await api.saveAnamnesis(7, { dividas_ativas: 10, comprometimento_renda: 20 })

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['get', '/customers'],
      ['get', '/customers'],
      ['get', '/customers/7'],
      ['post', '/customers'],
      ['put', '/customers/7/anamnesis'],
    ])
    expect(requests[0].params).toEqual({ q: 'ana', limit: 10 })
    expect(body(requests[3])).toMatchObject({ nome: 'Ana' })
    expect(body(requests[4])).toEqual({ dividas_ativas: 10, comprometimento_renda: 20 })
  })
})

describe('scoresApi', () => {
  it('avalia, lista strategies e histórico', async () => {
    const { http, requests } = fakeHttp(() => ({ data: [] }))
    const api = scoresApi(http)

    await api.strategies()
    await api.evaluate(3, 'simple')
    await api.history(3)

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['get', '/scores/strategies'],
      ['post', '/scores/evaluations'],
      ['get', '/scores/evaluations'],
    ])
    expect(body(requests[1])).toEqual({ customer_id: 3, strategy: 'simple' })
    expect(requests[2].params).toEqual({ customer_id: 3 })
  })

  it('score vigente: devolve a avaliação, null se 404 e propaga outros erros', async () => {
    const statusByCustomer: Record<string, number> = { '1': 200, '2': 404, '3': 500 }
    const { http } = fakeHttp((config) => {
      const id = config.url?.split('/')[3] ?? ''
      return { status: statusByCustomer[id], data: { id: 9 } }
    })
    const api = scoresApi(http)

    await expect(api.latest(1)).resolves.toEqual({ id: 9 })
    await expect(api.latest(2)).resolves.toBeNull()
    await expect(api.latest(3)).rejects.toThrow('HTTP 500')
  })
})

describe('accountsApi', () => {
  it('lista, consulta, cria conta, extrato e transação', async () => {
    const { http, requests } = fakeHttp(() => ({ data: {} }))
    const api = accountsApi(http)

    await api.list(5)
    await api.get(2)
    await api.create({ customerId: 5, saldoInicial: 100 })
    await api.statement(2)
    await api.registerTransaction({ accountId: 2, tipo: 'DEBIT', valor: 10 })

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['get', '/accounts'],
      ['get', '/accounts/2'],
      ['post', '/accounts'],
      ['get', '/accounts/2/transactions'],
      ['post', '/transactions'],
    ])
    expect(requests[0].params).toEqual({ customerId: 5 })
    expect(body(requests[4])).toEqual({ accountId: 2, tipo: 'DEBIT', valor: 10 })
  })
})

describe('creditsApi', () => {
  it('lista, consulta e solicita crédito', async () => {
    const { http, requests } = fakeHttp(() => ({ data: {} }))
    const api = creditsApi(http)

    await api.list()
    await api.get(4)
    await api.request({ customerId: 1, valor: 5000, prazoMeses: 12 })

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['get', '/credits'],
      ['get', '/credits/4'],
      ['post', '/credits'],
    ])
    expect(requests[0].params).toEqual({ customerId: undefined })
    expect(body(requests[2])).toEqual({ customerId: 1, valor: 5000, prazoMeses: 12 })
  })
})

describe('createApi', () => {
  it('cria os services das 3 APIs com o mesmo provedor de token', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt')
    const api = createApi(getToken)

    expect(Object.keys(api)).toEqual(['customers', 'scores', 'accounts', 'credits'])
  })
})
