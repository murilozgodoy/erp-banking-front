import { describe, expect, it } from 'vitest'

import { fakeJwt } from '@/test/auth0'

import { useMockApi } from '../test/portal'
import { responder } from './assistant'
import { RESPOSTA_RECUSA } from './assistantFixtures'
import { setMockStatus } from './db'

const URL = 'http://score.test/me/assistant/messages'

function post(body: unknown, headers: Record<string, string> = {}) {
  return fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const BASE = 'http://score.test/me/assistant'
const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE}${path}`, { headers })
const remove = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE}${path}`, { method: 'DELETE', headers })

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

  it('recusa o que está fora do escopo', () => {
    expect(pergunta('Devo investir em bitcoin?')).toBe(RESPOSTA_RECUSA)
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
    expect(Object.keys(body).sort()).toEqual([
      'acoes',
      'conversation_id',
      'fontes',
      'message_id',
      'resposta',
      'sugestoes',
    ])
    expect((await post({ messages: [{ role: 'user', content: '[500]' }] })).status).toBe(500)
    expect(
      (await post({ messages: [{ role: 'user', content: 'Oi' }], rota: 'x'.repeat(301) })).status,
    ).toBe(422)
    const limite = await post({ messages: [{ role: 'user', content: '[429]' }] })
    expect(limite.headers.get('Retry-After')).toBe('20')
  })

  it('409 com o onboarding pendente', async () => {
    setMockStatus('EM_ANALISE')
    const resposta = await post({ messages: [{ role: 'user', content: 'Oi' }] })
    expect(resposta.status).toBe(409)
    expect(await resposta.json()).toMatchObject({ error: 'ONBOARDING_PENDENTE' })
  })

  it('guarda as conversas por usuário: lista, abre, continua e apaga', async () => {
    const maria = { Authorization: `Bearer ${fakeJwt({ sub: 'auth0|maria' })}` }
    const joao = { Authorization: `Bearer ${fakeJwt({ sub: 'auth0|joao' })}` }
    const primeira = await post(
      { messages: [{ role: 'user', content: 'Quanto antecipo?' }] },
      maria,
    )
    const { conversation_id: id, message_id } = (await primeira.json()) as {
      conversation_id: string
      message_id: number
    }
    expect(message_id).toBeGreaterThan(0)
    const segunda = await post(
      { conversation_id: id, messages: [{ role: 'user', content: 'E o estoque?' }] },
      maria,
    )
    expect(((await segunda.json()) as { conversation_id: string }).conversation_id).toBe(id)

    const lista = await get('/conversations?limit=20&offset=0', maria)
    expect(await lista.json()).toEqual([
      { id, titulo: 'Quanto antecipo?', updated_at: expect.stringMatching(/Z$/), mensagens: 4 },
    ])
    expect(await (await get('/conversations', joao)).json()).toEqual([])
    expect((await get('/conversations?limit=0', maria)).status).toBe(422)
    expect((await get('/conversations?limit=101', maria)).status).toBe(422)
    expect((await get('/conversations?offset=-1', maria)).status).toBe(422)

    const detalhe = (await (await get(`/conversations/${id}`, maria)).json()) as {
      mensagens: { role: string; fontes: unknown[] }[]
    }
    expect(detalhe.mensagens.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(detalhe.mensagens[0].fontes).toEqual([])
    // Conversa de outra pessoa: 404, ao abrir, continuar ou apagar.
    expect((await get(`/conversations/${id}`, joao)).status).toBe(404)
    const alheia = await post(
      { conversation_id: id, messages: [{ role: 'user', content: 'Oi' }] },
      joao,
    )
    expect(alheia.status).toBe(404)
    expect(await alheia.json()).toEqual({ error: 'CONVERSA_NAO_ENCONTRADA' })
    expect((await remove(`/conversations/${id}`, joao)).status).toBe(404)

    expect((await remove(`/conversations/${id}`, maria)).status).toBe(204)
    expect((await get(`/conversations/${id}`, maria)).status).toBe(404)
    await post({ messages: [{ role: 'user', content: 'Outra' }] }, maria)
    expect((await remove('/conversations', maria)).status).toBe(204)
    expect((await remove('/conversations', maria)).status).toBe(204)
    expect(await (await get('/conversations', maria)).json()).toEqual([])
  })

  it('503 salva a pergunta e devolve a conversa; 403 e 429 não salvam', async () => {
    const indisponivel = await post({ messages: [{ role: 'user', content: 'Oi [503]' }] })
    expect(indisponivel.status).toBe(503)
    const { conversation_id: id } = (await indisponivel.json()) as { conversation_id: string }
    const detalhe = (await (await get(`/conversations/${id}`)).json()) as {
      mensagens: { content: string }[]
    }
    expect(detalhe.mensagens.map((m) => m.content)).toEqual(['Oi [503]'])
    const semPermissao = await post({ messages: [{ role: 'user', content: '[403]' }] })
    expect(semPermissao.status).toBe(403)
    expect(await semPermissao.json()).toEqual({
      error: 'SEM_PERMISSAO',
      permissao: 'usar_assistente',
    })
    expect(await (await get('/conversations')).json()).toHaveLength(1)
  })
})
