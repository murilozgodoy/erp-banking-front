import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { RESPOSTA_RECEBIVEIS } from '../mocks/assistantFixtures'
import * as store from '../mocks/assistantStore'
import { renderPortal, useMockApi } from '../test/portal'
import type { AssistantRequest } from '../types'
import { AssistantLauncher } from './AssistantLauncher'
import { AssistantProvider } from './AssistantProvider'
import { chipLabel } from './suggestions'
import { PAGE_SIZE, storageKey } from './useAssistant'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const SUB = 'auth0|tester'
const KEY = storageKey(SUB)
const BASE = 'http://score.test/me/assistant'

function renderAssistant() {
  return renderPortal(
    <AssistantProvider>
      <AssistantLauncher />
    </AssistantProvider>,
    { route: '/app/recebiveis', path: '/app/*' },
  )
}

const launcher = () => screen.getAllByRole('button', { name: 'Perguntar à ErpIa' })[0]
const composer = () => screen.getByRole('textbox', { name: 'Sua pergunta para a ErpIa' })
const history = () => screen.getByRole('button', { name: 'Conversas' })

/** Conversa guardada no mock (pergunta + resposta com fontes, ações e sugestões). */
function seed(pergunta: string, resposta = RESPOSTA_RECEBIVEIS, sub = SUB) {
  const conversa = store.criar(sub, pergunta)
  const vazia = { fontes: [], acoes: [], sugestoes: [] }
  store.adicionar(sub, conversa.id, { role: 'user', content: pergunta, ...vazia })
  store.adicionar(sub, conversa.id, {
    role: 'assistant',
    content: resposta.resposta,
    fontes: resposta.fontes,
    acoes: resposta.acoes,
    sugestoes: resposta.sugestoes,
  })
  return conversa.id
}

describe('Histórico do assistente', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => localStorage.clear())

  it('lista as conversas do usuário e retoma uma com fontes, ações e sugestões', async () => {
    seed('Quanto consigo antecipar?')
    seed('Quais itens estão parados?')
    seed('Conversa de outra pessoa', RESPOSTA_RECEBIVEIS, 'auth0|outra')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(`${BASE}/conversations`, async () => {
        await gate
        return undefined
      }),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    expect(composer()).toHaveAttribute('placeholder', 'Converse com a ErpIa…')
    await user.click(history())
    expect(screen.getByRole('status', { name: 'Carregando as conversas' })).toBeInTheDocument()
    release()
    const itens = await screen.findAllByRole('button', { name: /mensagens$/ })
    expect(itens.map((item) => item.textContent)).toEqual([
      'Quais itens estão parados?hoje · 2 mensagens',
      'Quanto consigo antecipar?hoje · 2 mensagens',
    ])
    expect(screen.queryByText('Conversa de outra pessoa')).not.toBeInTheDocument()

    await user.click(itens[1])
    const log = await screen.findByRole('log', { name: 'Conversa com o assistente' })
    expect(
      within(log).getByRole('heading', { name: /Você perguntou:\s*Quanto consigo antecipar\?/ }),
    ).toBeInTheDocument()
    expect(within(log).getByText('Agenda de recebíveis')).toBeInTheDocument()
    expect(within(log).getByRole('button', { name: /Leitura concluída · 3 fontes/ })).toBeVisible()
    expect(within(log).getByRole('button', { name: 'Simular antecipação' })).toBeInTheDocument()
    // Sugestão com rótulo curto no chip e a pergunta inteira no nome acessível e no title.
    const chip = within(log).getByRole('button', { name: 'Quanto custa antecipar R$ 42 mil?' })
    expect(chip).toHaveTextContent(/^Quanto custa antecipar$/)
    expect(chip).toHaveAttribute('title', 'Quanto custa antecipar R$ 42 mil?')

    // Continua na mesma conversa (o histórico vem do back).
    await user.click(chip)
    await waitFor(() => expect(within(log).getAllByText('Baseado em:')).toHaveLength(2))
    const aberta = localStorage.getItem(KEY) ?? ''
    expect(store.buscar(SUB, aberta)?.mensagens).toHaveLength(4)

    // "Nova conversa" volta à tela inicial; a lista mostra a conversa atualizada no topo.
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByText('Olá, Maria.')).toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBeNull()
    await user.click(history())
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /mensagens$/ })[0]).toHaveTextContent(
        'Quanto consigo antecipar?hoje · 4 mensagens',
      ),
    )
  })

  it('estado vazio e erro com nova tentativa', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/conversations`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ detail: 'Falhou' }, { status: 500 })
          : HttpResponse.json([])
      }),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.click(history())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos carregar as conversas')
    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Suas conversas aparecem aqui.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Opções do histórico' })).not.toBeInTheDocument()
  })

  it('pagina a lista de 20 em 20', async () => {
    for (let index = 0; index <= PAGE_SIZE; index += 1) seed(`Pergunta ${index}`)
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.click(history())
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Apagar a conversa/ })).toHaveLength(PAGE_SIZE),
    )
    await user.click(screen.getByRole('button', { name: 'Mostrar mais conversas' }))
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Apagar a conversa/ })).toHaveLength(
        PAGE_SIZE + 1,
      ),
    )
    expect(screen.queryByRole('button', { name: 'Mostrar mais conversas' })).not.toBeInTheDocument()
  })

  it('apaga uma conversa com confirmação inline (cancelar e apagar)', async () => {
    const id = seed('Quanto consigo antecipar?')
    seed('Quais itens estão parados?')
    localStorage.setItem(KEY, id)
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    expect(await screen.findByText('Agenda de recebíveis')).toBeInTheDocument()
    await user.click(history())
    const apagar = await screen.findByRole('button', {
      name: 'Apagar a conversa "Quanto consigo antecipar?"',
    })
    await user.click(apagar)
    const confirmacao = screen.getByRole('group', { name: 'Apagar esta conversa?' })
    expect(within(confirmacao).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: 'Apagar esta conversa?' })).not.toBeInTheDocument()

    // Falha ao apagar: avisa na própria linha.
    server.use(
      http.delete(`${BASE}/conversations/:id`, () =>
        HttpResponse.json({ detail: 'Falhou' }, { status: 500 }),
      ),
    )
    await user.click(
      screen.getByRole('button', { name: 'Apagar a conversa "Quanto consigo antecipar?"' }),
    )
    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível apagar agora')
    server.resetHandlers()

    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    await waitFor(() =>
      expect(screen.queryByText('Quanto consigo antecipar?')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Quais itens estão parados?')).toBeInTheDocument()
    expect(store.buscar(SUB, id)).toBeNull()
    // Era a conversa aberta: o id guardado some e o painel volta à tela inicial.
    expect(localStorage.getItem(KEY)).toBeNull()
    await user.click(history())
    expect(screen.getByText('Olá, Maria.')).toBeInTheDocument()
  })

  it('apagar uma conversa que já não existe só a tira da lista', async () => {
    seed('Quanto consigo antecipar?')
    server.use(
      http.delete(`${BASE}/conversations/:id`, () =>
        HttpResponse.json({ error: 'CONVERSA_NAO_ENCONTRADA' }, { status: 404 }),
      ),
      http.get(`${BASE}/conversations`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.click(history())
    expect(await screen.findByText('Suas conversas aparecem aqui.')).toBeInTheDocument()
  })

  it('apaga todo o histórico pelas opções, com confirmação inline', async () => {
    seed('Quanto consigo antecipar?')
    seed('Quais itens estão parados?')
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.click(history())
    const opcoes = await screen.findByRole('button', { name: 'Opções do histórico' })
    expect(opcoes).toHaveAttribute('aria-expanded', 'false')
    await user.click(opcoes)
    expect(opcoes).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Apagar todo o histórico' }))
    const confirmacao = screen.getByRole('group', { name: 'Apagar todas as conversas?' })
    await user.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getAllByRole('button', { name: /^Apagar a conversa/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Apagar todo o histórico' }))
    await user.click(screen.getByRole('button', { name: 'Apagar tudo' }))
    expect(await screen.findByText('Suas conversas aparecem aqui.')).toBeInTheDocument()
    expect(store.listar(SUB, 100, 0)).toEqual([])
  })

  it('recarregar a página reabre a conversa pelo id guardado', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Quanto consigo antecipar?{Enter}')
    await screen.findByText('Baseado em:')
    const id = localStorage.getItem(KEY)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    unmount()

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(`${BASE}/conversations/:id`, async () => {
        await gate
        return undefined
      }),
    )
    renderAssistant()
    await user.click(launcher())
    expect(screen.getByRole('status', { name: 'Carregando a conversa' })).toBeInTheDocument()
    release()
    expect(
      await screen.findByRole('heading', { name: /Você perguntou:\s*Quanto consigo antecipar\?/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leitura concluída/ })).toBeInTheDocument()
  })

  it('erro ao abrir a conversa mostra a nova tentativa', async () => {
    const id = seed('Quanto consigo antecipar?')
    localStorage.setItem(KEY, id)
    let calls = 0
    server.use(
      http.get(`${BASE}/conversations/:id`, () => {
        calls += 1
        return calls === 1 ? HttpResponse.json({ detail: 'Falhou' }, { status: 500 }) : undefined
      }),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não conseguimos abrir esta conversa')
    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Agenda de recebíveis')).toBeInTheDocument()
  })

  it('404 ao reabrir esquece o id e volta à tela inicial', async () => {
    localStorage.setItem(KEY, 'conversa-apagada')
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    expect(await screen.findByText('Olá, Maria.')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull())
  })

  it('404 ao enviar: avisa e a nova tentativa começa outra conversa', async () => {
    const id = seed('Quanto consigo antecipar?')
    localStorage.setItem(KEY, id)
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await screen.findByText('Agenda de recebíveis')
    store.apagar(SUB, id)
    await user.type(composer(), 'E o estoque?{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta conversa não está mais disponível',
    )
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await screen.findByText('Baseado em:')
    const novo = localStorage.getItem(KEY)
    expect(novo).not.toBe(id)
    expect(store.buscar(SUB, novo ?? '')?.titulo).toBe('E o estoque?')
  })

  it('503 com conversation_id: a pergunta fica salva e "Tentar de novo" segue na conversa', async () => {
    const bodies: AssistantRequest[] = []
    server.use(
      http.post(`${BASE}/messages`, async ({ request }) => {
        bodies.push((await request.json()) as AssistantRequest)
        return bodies.length === 1
          ? HttpResponse.json(
              { error: 'ASSISTENTE_INDISPONIVEL', conversation_id: 'c-503' },
              { status: 503 },
            )
          : HttpResponse.json({ ...RESPOSTA_RECEBIVEIS, conversation_id: 'c-503', message_id: 9 })
      }),
      http.get(`${BASE}/conversations/:id`, () =>
        HttpResponse.json({ id: 'c-503', titulo: 'Quanto antecipo?', mensagens: [] }),
      ),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Quanto antecipo?{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O assistente está indisponível no momento',
    )
    expect(localStorage.getItem(KEY)).toBe('c-503')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Agenda de recebíveis')).toBeInTheDocument()
    expect(bodies[0]).not.toHaveProperty('conversation_id')
    expect(bodies[1]).toMatchObject({ conversation_id: 'c-503' })
    expect(screen.getAllByRole('heading', { name: /Quanto antecipo\?/ })).toHaveLength(1)
  })

  it('503 do mock salva a pergunta na conversa', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Teste [[503]{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('indisponível')
    const id = localStorage.getItem(KEY) ?? ''
    expect(store.buscar(SUB, id)?.mensagens.map((m) => m.content)).toEqual(['Teste [503]'])
    // A pergunta salva aparece uma vez só (como pendente), mesmo depois de buscar a conversa.
    expect(screen.getAllByRole('heading', { name: /Teste \[503\]/ })).toHaveLength(1)
  })

  it('403 sem a permissão de usar o assistente', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Teste [[403]{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Peça a um administrador a permissão de usar o assistente.',
    )
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('rótulos curtos das sugestões', () => {
  it.each([
    ['Quanto custa antecipar R$ 42 mil?', 'Quanto custa antecipar'],
    ['Capital de giro sai mais barato?', 'Capital de giro'],
    ['E se eu antecipar só R$ 30 mil?', 'Antecipar só R$ 30 mil'],
    ['Antecipação ou capital de giro: qual faz mais sentido agora?', 'Antecipação ou capital'],
    ['Quando meu caixa fica negativo, e por quê?', 'Quando meu caixa'],
    ['Oi', 'Oi'],
  ])('"%s" → "%s"', (pergunta, rotulo) => {
    const label = chipLabel(pergunta)
    expect(label).toBe(rotulo)
    expect(label.length).toBeLessThanOrEqual(28)
    expect(label).not.toContain('…')
    expect(pergunta.replace('E se eu a', 'A')).toContain(label)
  })

  it('não corta uma palavra no meio', () => {
    expect(chipLabel('Descentralizadamente')).toBe('Descentralizadamente')
    expect(chipLabel('   ')).toBe('')
  })
})
