import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type {
  InviteResponse,
  Me,
  Payment,
  PaymentResponse,
  PortalCreditRequest,
  TeamMember,
} from '../types'
import { resetMockDb } from './db'
import { mockServer } from './server'
import { setMembroLogado } from './team'

const O = 'http://onboarding.test'
const T = 'http://transactions.test'

async function chamar<R>(url: string, method = 'GET', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const texto = await response.text()
  return { status: response.status, data: (texto ? JSON.parse(texto) : null) as R }
}

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => resetMockDb('APROVADO'))
afterEach(() => {
  mockServer.resetHandlers()
  setMembroLogado(null)
})
afterAll(() => mockServer.close())

describe('mocks da equipe (seção 11)', () => {
  it('GET /me traz o membro logado (DONO por padrão)', async () => {
    const { data } = await chamar<Me>(`${O}/me`)
    expect(data.membro).toMatchObject({ papel: 'DONO', status: 'ATIVO', limite_pagamento: null })
    expect(data.membro!.permissoes).toContain('gerenciar_equipe')
  })

  it('lista, convida (com link), edita, suspende e remove; o DONO é imutável', async () => {
    const lista = await chamar<TeamMember[]>(`${O}/me/team`)
    expect(lista.data.map((m) => m.papel)).toEqual(['DONO', 'FINANCEIRO', 'OPERADOR', 'LEITURA'])

    const invalido = await chamar(`${O}/me/team/invites`, 'POST', { nome: '', email: 'x' })
    expect(invalido.status).toBe(400)

    const convite = await chamar<InviteResponse>(`${O}/me/team/invites`, 'POST', {
      nome: 'Bia Rocha',
      email: 'bia@aurorapaes.com.br',
      papel: 'OPERADOR',
      limite_pagamento: 1500,
    })
    expect(convite.status).toBe(201)
    expect(convite.data.convite_url).toMatch(/\/convite\/convite-/)
    expect(convite.data.membro).toMatchObject({ status: 'CONVIDADO', limite_pagamento: 1500 })
    const repetido = await chamar(`${O}/me/team/invites`, 'POST', {
      nome: 'Bia',
      email: 'bia@aurorapaes.com.br',
      papel: 'LEITURA',
    })
    expect(repetido.status).toBe(409)

    const id = convite.data.membro.id
    const editado = await chamar<TeamMember>(`${O}/me/team/${id}`, 'PATCH', { papel: 'FINANCEIRO' })
    expect(editado.data.permissoes).toContain('aprovar_pagamentos')
    const suspenso = await chamar<TeamMember>(`${O}/me/team/${id}`, 'PATCH', { status: 'SUSPENSO' })
    expect(suspenso.data.status).toBe('SUSPENSO')
    expect((await chamar(`${O}/me/team/1`, 'PATCH', { status: 'SUSPENSO' })).status).toBe(422)
    expect((await chamar(`${O}/me/team/1`, 'DELETE')).status).toBe(422)
    expect((await chamar(`${O}/me/team/${id}`, 'DELETE')).status).toBe(204)
    expect((await chamar(`${O}/me/team/${id}`, 'DELETE')).status).toBe(404)

    const token = convite.data.convite_url.split('/convite/')[1]
    expect((await chamar(`${O}/me/team/invites/${token}/accept`, 'POST')).status).toBe(404)
  })

  it('aceita convite e devolve os erros do contrato', async () => {
    const ok = await chamar<TeamMember>(`${O}/me/team/invites/convite-demo-contador/accept`, 'POST')
    expect(ok.data.status).toBe('ATIVO')
    expect((await chamar(`${O}/me/team/invites/convite-expirado/accept`, 'POST')).status).toBe(410)
    expect((await chamar(`${O}/me/team/invites/convite-outra-empresa/accept`, 'POST')).status).toBe(
      409,
    )
  })

  it('sem permissão: 403 SEM_PERMISSAO na equipe e no financeiro', async () => {
    setMembroLogado('LEITURA')
    expect(await chamar(`${O}/me/team`)).toMatchObject({
      status: 403,
      data: { error: 'SEM_PERMISSAO', permissao: 'gerenciar_equipe' },
    })
    expect(await chamar(`${T}/me/payments`, 'POST', {})).toMatchObject({
      status: 403,
      data: { permissao: 'pagar' },
    })
    expect((await chamar(`${T}/me/overview`)).status).toBe(200)
  })

  it('acima do limite fica pendente; outra pessoa aprova ou rejeita; o autor não aprova', async () => {
    setMembroLogado('OPERADOR')
    const pago = await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', {
      tipo: 'PIX',
      valor: 5000,
      destinatario: 'Moinho Paulista',
    })
    expect(pago.data.status).toBe('PENDENTE_APROVACAO')
    expect((await chamar(`${T}/me/payments/pending`)).status).toBe(403)

    setMembroLogado('FINANCEIRO')
    const pendentes = await chamar<Payment[]>(`${T}/me/payments/pending`)
    expect(pendentes.data).toHaveLength(1)
    expect(pendentes.data[0].created_by_nome).toBe('Júlia Santos')
    const aprovado = await chamar<PaymentResponse>(
      `${T}/me/payments/${pago.data.id}/approve`,
      'POST',
    )
    expect(aprovado.data.status).toBe('EFETIVADO')
    expect(aprovado.data.comprovante.valor).toBe(5000)
    const historico = await chamar<Payment[]>(`${T}/me/payments`)
    expect(historico.data.find((p) => p.id === pago.data.id)).toMatchObject({
      approved_by_nome: 'Rafael Lima',
    })
    expect((await chamar(`${T}/me/payments/${pago.data.id}/reject`, 'POST')).status).toBe(422)
    expect((await chamar(`${T}/me/payments/999999/approve`, 'POST')).status).toBe(404)

    const meu = await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', {
      tipo: 'PIX',
      valor: 25_000,
      destinatario: 'Fornecedor',
    })
    expect(meu.data.status).toBe('PENDENTE_APROVACAO')
    expect(await chamar(`${T}/me/payments/${meu.data.id}/approve`, 'POST')).toMatchObject({
      status: 403,
      data: { error: 'SEM_PERMISSAO', motivo: 'AUTOR' },
    })
    setMembroLogado('DONO')
    const rejeitado = await chamar<Payment>(`${T}/me/payments/${meu.data.id}/reject`, 'POST', {
      motivo: 'Fornecedor errado',
    })
    expect(rejeitado.data).toMatchObject({
      status: 'REJEITADO',
      rejected_by_nome: 'Marina Costa',
      motivo_rejeicao: 'Fornecedor errado',
    })
  })

  it('não aceita um segundo pagamento para a conta que já espera aprovação', async () => {
    setMembroLogado('OPERADOR')
    const conta = (
      await chamar<{ itens: { id: number; valor: number; status: string }[] }>(`${T}/me/payables`)
    ).data.itens.find((c) => c.status === 'ABERTO' && c.valor > 2000 && c.valor < 10_000)!
    const pedido = { tipo: 'TED', valor: conta.valor, destinatario: 'X', payable_id: conta.id }
    expect((await chamar<PaymentResponse>(`${T}/me/payments`, 'POST', pedido)).data.status).toBe(
      'PENDENTE_APROVACAO',
    )
    expect(await chamar(`${T}/me/payments`, 'POST', pedido)).toMatchObject({
      status: 422,
      data: { error: 'PAGAMENTO_PENDENTE' },
    })
  })

  it('quem só pede crédito deixa a proposta aguardando; quem contrata confirma', async () => {
    setMembroLogado('FINANCEIRO')
    const sim = await chamar<{ id: string }>(`${T}/me/credit/simulations`, 'POST', {
      produto: 'CAPITAL_DE_GIRO',
      valor: 5000,
      prazo_meses: 6,
    })
    const proposta = await chamar<PortalCreditRequest>(`${T}/me/credit/requests`, 'POST', {
      simulation_id: sim.data.id,
    })
    expect(proposta.data).toMatchObject({
      status: 'AGUARDANDO_CONTRATACAO',
      createdByNome: 'Rafael Lima',
    })
    const url = `${T}/me/credit/requests/${proposta.data.id}/confirm`
    expect(await chamar(url, 'POST')).toMatchObject({
      status: 403,
      data: { error: 'SEM_PERMISSAO', permissao: 'contratar_credito' },
    })
    setMembroLogado('DONO')
    expect((await chamar<PortalCreditRequest>(url, 'POST')).data.status).toBe('APROVADO')
    expect(await chamar(url, 'POST')).toMatchObject({
      status: 422,
      data: { error: 'PEDIDO_NAO_AGUARDANDO_CONTRATACAO' },
    })
    expect((await chamar(`${T}/me/credit/requests/9999/confirm`, 'POST')).status).toBe(404)
  })
})
