import { describe, expect, it } from 'vitest'

import { useMockApi } from '../test/portal'
import { responder } from './assistant'
import { setMockStatus } from './db'

const URL = 'http://score.test/me/assistant/messages'

function post(body: unknown) {
  return fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const pergunta = (content: string, rota?: string) =>
  responder({ messages: [{ role: 'user', content }], rota })

describe('mock do assistente', () => {
  useMockApi('APROVADO')

  it.each([
    ['Quando meu caixa fica negativo?', 'overview'],
    ['Quanto consigo antecipar?', 'recebiveis'],
    ['Quais itens estão parados?', 'estoque'],
    ['Quais boletos vencem esta semana?', 'pagamentos'],
    ['Quais produtos mais vendem?', 'vendas'],
    ['O que devo resolver primeiro?', 'pendencias'],
    ['Qual é o meu limite pré-aprovado?', 'credito'],
  ])('"%s" responde com a fonte %s', (texto, fonte) => {
    const resposta = pergunta(texto)
    expect(resposta.resposta.length).toBeGreaterThan(20)
    expect(resposta.fontes.map((f) => f.tipo)).toContain(fonte)
    expect(resposta.sugestoes.length).toBeGreaterThanOrEqual(1)
    for (const acao of resposta.acoes) expect(acao.rota.startsWith('/app')).toBe(true)
  })

  it('sem palavra-chave, usa a tela', () => {
    expect(pergunta('Oi', '/app/estoque').fontes[0].tipo).toBe('estoque')
    expect(pergunta('Oi').fontes[0].tipo).toBe('overview')
  })

  it('valida o corpo e responde 200 com o contrato', async () => {
    expect((await post('{')).status).toBe(422)
    expect((await post({ messages: [] })).status).toBe(422)
    expect((await post({ messages: [{ role: 'assistant', content: 'x' }] })).status).toBe(422)
    expect((await post({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] })).status).toBe(
      422,
    )
    const ok = await post({ messages: [{ role: 'user', content: 'Oi' }], rota: '/app/vendas' })
    expect(ok.status).toBe(200)
    const body = (await ok.json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['acoes', 'fontes', 'resposta', 'sugestoes'])
    expect((await post({ messages: [{ role: 'user', content: '[500]' }] })).status).toBe(500)
  })

  it('409 com o onboarding pendente', async () => {
    setMockStatus('EM_ANALISE')
    const resposta = await post({ messages: [{ role: 'user', content: 'Oi' }] })
    expect(resposta.status).toBe(409)
    expect(await resposta.json()).toMatchObject({ error: 'ONBOARDING_PENDENTE' })
  })
})
