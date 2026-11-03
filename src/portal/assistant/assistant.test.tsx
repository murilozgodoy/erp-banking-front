import { useAuth0 } from '@auth0/auth0-react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { renderPortal, useMockApi } from '../test/portal'
import type { AssistantRequest, AssistantResponse } from '../types'
import { InsightBlock } from '../ui/InsightBlock'
import { AssistantLauncher } from './AssistantLauncher'
import { AssistantProvider } from './AssistantProvider'
import { Markdown } from './markdown'
import { insightQuestion, screenFor, suggestionsFor, thinkingStatus } from './suggestions'
import { classify, storageKey, toApiMessages, type ChatEntry } from './useAssistant'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const URL = 'http://score.test/me/assistant/messages'
const KEY = storageKey('auth0|tester')

function Where() {
  const location = useLocation()
  return (
    <p data-testid="where">
      {location.pathname}
      {location.search}
    </p>
  )
}

function Harness() {
  return (
    <AssistantProvider>
      <AssistantLauncher />
      <InsightBlock
        insight={{
          titulo: 'Caixa negativo em 18 dias',
          texto: 'Antecipar R$ 42 mil cobre o vale.',
          severidade: 'atencao',
        }}
      />
      <input aria-label="Busca" />
      <Where />
    </AssistantProvider>
  )
}

function renderAssistant(route = '/app/recebiveis') {
  return renderPortal(<Harness />, { route, path: '/app/*' })
}

const launcher = () => screen.getAllByRole('button', { name: 'Perguntar à ErpIa' })[0]
const dialog = () => screen.getByRole('dialog', { name: 'Assistente ErpIa' })
const composer = () => screen.getByRole('textbox', { name: 'Sua pergunta para a ErpIa' })

const RESPOSTA: AssistantResponse = {
  resposta: 'Você tem **R$ 120 mil** a receber.\n\n- Stone: R$ 70 mil\n- Cielo: R$ 50 mil',
  sugestoes: ['Qual adquirente concentra mais?', 'Quando meu caixa fica negativo?'],
  fontes: [
    { tipo: 'recebiveis', label: 'Recebíveis' },
    { tipo: 'overview', label: 'Visão geral' },
  ],
  acoes: [
    {
      label: 'Simular antecipação',
      rota: '/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=42000',
    },
    { label: 'Site externo', rota: 'https://exemplo.com' },
  ],
}

describe('Assistente ErpIa', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => sessionStorage.clear())

  /** Responde com `RESPOSTA` e guarda os corpos recebidos; `gate` segura a resposta. */
  function answerWith(response = RESPOSTA, gate?: Promise<void>) {
    const bodies: AssistantRequest[] = []
    server.use(
      http.post(URL, async ({ request }) => {
        bodies.push((await request.json()) as AssistantRequest)
        if (gate) await gate
        return HttpResponse.json(response)
      }),
    )
    return bodies
  }

  it('abre pelo botão com as sugestões da tela; Esc fecha e devolve o foco', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    const sheet = dialog()
    expect(within(sheet).getByText('Sugestões para Recebíveis')).toBeInTheDocument()
    for (const pergunta of suggestionsFor('/app/recebiveis')) {
      expect(within(sheet).getByRole('button', { name: pergunta })).toBeInTheDocument()
    }
    expect(
      within(sheet).getByText(
        'Respostas geradas por IA com base nos dados da sua empresa. Confira antes de decidir.',
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(composer()).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(launcher()).toHaveFocus()
  })

  it('abre e fecha com Ctrl+K e ⌘+K, mesmo com o foco num campo', async () => {
    const user = userEvent.setup()
    renderAssistant('/app/estoque')
    await user.click(screen.getByRole('textbox', { name: 'Busca' }))
    await user.keyboard('{Control>}k{/Control}')
    expect(dialog()).toBeInTheDocument()
    expect(screen.getByText('Sugestões para Estoque')).toBeInTheDocument()
    await user.keyboard('{Meta>}k{/Meta}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.keyboard('k')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('envia, mostra o "pensando" e a resposta com fontes, ações e sugestões', async () => {
    let release!: () => void
    const bodies = answerWith(
      RESPOSTA,
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Quanto tenho a receber?{Enter}')

    expect(await screen.findByTestId('assistant-thinking')).toHaveTextContent(
      thinkingStatus('/app/recebiveis')[0],
    )
    expect(
      screen.getByRole('heading', { name: /Você perguntou:\s*Quanto tenho a receber\?/ }),
    ).toBeInTheDocument()
    expect(composer()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled()
    expect(bodies[0]).toEqual({
      messages: [{ role: 'user', content: 'Quanto tenho a receber?' }],
      rota: '/app/recebiveis',
    })

    await act(async () => release())
    const log = await screen.findByRole('log', { name: 'Conversa com o assistente' })
    expect(await within(log).findByText('R$ 120 mil')).toHaveProperty('tagName', 'STRONG')
    expect(within(log).getByText('Stone: R$ 70 mil').tagName).toBe('LI')
    expect(screen.queryByTestId('assistant-thinking')).not.toBeInTheDocument()
    expect(within(log).getByText('Baseado em:')).toBeInTheDocument()
    expect(within(log).getByText('Visão geral')).toBeInTheDocument()
    expect(within(log).getByTestId('fontes-check')).toBeInTheDocument()
    expect(within(log).getByRole('button', { name: 'Simular antecipação' })).toBeInTheDocument()
    // Rotas fora do portal não viram botão (a resposta é tratada como dado).
    expect(within(log).queryByRole('button', { name: 'Site externo' })).not.toBeInTheDocument()
    expect(
      within(log).getByRole('button', { name: 'Qual adquirente concentra mais?' }),
    ).toBeInTheDocument()
  })

  it('a sugestão vira pergunta; as sugestões ficam só abaixo da última resposta', async () => {
    const bodies = answerWith()
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.click(screen.getByRole('button', { name: suggestionsFor('/app/recebiveis')[0] }))
    await user.click(await screen.findByRole('button', { name: 'Qual adquirente concentra mais?' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1].messages).toEqual([
      { role: 'user', content: suggestionsFor('/app/recebiveis')[0] },
      { role: 'assistant', content: RESPOSTA.resposta },
      { role: 'user', content: 'Qual adquirente concentra mais?' },
    ])
    await waitFor(() => expect(screen.getAllByText('Baseado em:')).toHaveLength(2))
    expect(screen.getAllByRole('button', { name: 'Qual adquirente concentra mais?' })).toHaveLength(
      1,
    )
  })

  it('a ação navega e fecha o painel', async () => {
    answerWith()
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Quanto antecipo?{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Simular antecipação' }))
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/app/credito?produto=ANTECIPACAO_RECEBIVEIS&valor=42000',
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it.each([
    ['[503]', 'O assistente está indisponível no momento'],
    ['[429]', 'Você atingiu o limite de 10 perguntas por minuto. Tente de novo em instantes.'],
  ])('erro %s com mensagem clara', async (marker, message) => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), `Teste [${marker}{Enter}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('409 leva ao status do cadastro', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Teste [[409]{Enter}')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('cadastro da empresa for aprovado')
    await user.click(within(alert).getByRole('link', { name: 'Ver o status do cadastro' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/app/status')
  })

  it('falha de rede: "Tentar de novo" reenvia a mesma pergunta', async () => {
    let calls = 0
    server.use(
      http.post(URL, () => {
        calls += 1
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(RESPOSTA)
      }),
    )
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Minha pergunta{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('R$ 120 mil')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: /Minha pergunta/ })).toHaveLength(1)
  })

  it('guarda a conversa na sessão; "Nova conversa" limpa', async () => {
    answerWith()
    const user = userEvent.setup()
    const { unmount } = renderAssistant()
    await user.click(launcher())
    await user.type(composer(), 'Quanto tenho?{Enter}')
    await screen.findByText('R$ 120 mil')
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as ChatEntry[]
    expect(saved.map((entry) => entry.role)).toEqual(['user', 'assistant'])
    unmount()

    renderAssistant()
    await user.click(launcher())
    expect(screen.getByText('R$ 120 mil')).toBeInTheDocument()
    // Restaurada do histórico: sem o check desenhado de novo, mas com as sugestões.
    expect(screen.getByRole('button', { name: 'Qual adquirente concentra mais?' }))
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByText('Sugestões para Recebíveis')).toBeInTheDocument()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('manda no máximo 20 mensagens, começando por uma pergunta', async () => {
    const history: ChatEntry[] = Array.from({ length: 24 }, (_, index) =>
      index % 2 === 0
        ? { id: `q${index}`, role: 'user', content: `Pergunta ${index}` }
        : {
            id: `a${index}`,
            role: 'assistant',
            content: `Resposta ${index}`,
            fontes: [],
            acoes: [],
            sugestoes: [],
          },
    )
    sessionStorage.setItem(KEY, JSON.stringify(history))
    const bodies = answerWith()
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    expect(screen.getByText('Resposta 23')).toBeInTheDocument()
    await user.type(composer(), 'Nova{Enter}')
    await waitFor(() => expect(bodies).toHaveLength(1))
    const { messages } = bodies[0]
    expect(messages).toHaveLength(19)
    expect(messages[0]).toEqual({ role: 'user', content: 'Pergunta 6' })
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Nova' })
  })

  it('Shift+Enter quebra a linha e o contador aparece perto do limite', async () => {
    const bodies = answerWith()
    const user = userEvent.setup()
    renderAssistant()
    await user.click(launcher())
    expect(screen.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled()
    await user.type(composer(), 'linha 1{Shift>}{Enter}{/Shift}linha 2')
    expect(composer()).toHaveValue('linha 1\nlinha 2')
    expect(bodies).toHaveLength(0)
    await user.clear(composer())
    await user.click(composer())
    await user.paste('a'.repeat(2100))
    expect(composer()).toHaveValue('a'.repeat(2000))
    expect(screen.getByText('2.000/2.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar pergunta' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
  })

  it('"Perguntar à ErpIa sobre isso" abre com a pergunta escrita, sem enviar', async () => {
    const bodies = answerWith()
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByRole('button', { name: 'Perguntar à ErpIa sobre isso' }))
    expect(dialog()).toBeInTheDocument()
    expect(composer()).toHaveValue(
      'Sobre "Caixa negativo em 18 dias": Antecipar R$ 42 mil cobre o vale. O que está causando isso e o que você recomenda?',
    )
    expect(bodies).toHaveLength(0)
  })

  it('o mock responde pela pergunta e pela tela, com os números do banco', async () => {
    const user = userEvent.setup()
    renderAssistant('/app/estoque')
    await user.click(launcher())
    await user.click(
      screen.getByRole('button', {
        name: 'Quais itens estão parados e quanto dinheiro eles prendem?',
      }),
    )
    expect(await screen.findByText(/parados em/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver estoque' })).toBeInTheDocument()
  })
})

describe('InsightBlock fora do portal', () => {
  it('não mostra o atalho do assistente sem o provider', () => {
    render(<InsightBlock insight={{ titulo: 'Título', texto: 'Texto', severidade: 'info' }} />)
    expect(screen.queryByText(/sobre isso/)).not.toBeInTheDocument()
  })
})

describe('markdown do assistente', () => {
  it('renderiza parágrafos, listas, numeração e negrito', () => {
    const { container } = render(
      <Markdown
        source={
          '# Resumo\nPrimeira linha\nsegunda linha\n\n1. Um **forte**\n2. Dois\n   continuação\n\n* item\n\nFim'
        }
      />,
    )
    expect(screen.getByText('Resumo')).toHaveClass('font-semibold')
    expect(container.querySelectorAll('p br')).toHaveLength(1)
    const ol = container.querySelector('ol')!
    expect(ol.querySelectorAll('li')).toHaveLength(2)
    expect(ol.querySelectorAll('li')[1]).toHaveTextContent('Dois continuação')
    expect(screen.getByText('forte').tagName).toBe('STRONG')
    expect(container.querySelector('ul li')).toHaveTextContent('item')
    expect(screen.getByText('Fim').closest('p')).not.toBeNull()
  })

  it('não injeta HTML', () => {
    const { container } = render(
      <Markdown source={'<img src=x onerror="alert(1)"> **<b>oi</b>**\n- <script>x</script>'} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">')
  })
})

describe('regras do assistente', () => {
  it('mapeia telas e sugestões', () => {
    expect(screenFor('/app/recebiveis/')).toBe('/app/recebiveis')
    expect(screenFor('/app/credito/123')).toBe('/app/credito')
    expect(screenFor('/app/desconhecida')).toBe('/app')
    expect(suggestionsFor('/app').length).toBeGreaterThanOrEqual(4)
    for (const tela of ['/app/vendas', '/app/pagamentos', '/app/pendencias', '/app/credito']) {
      const perguntas = suggestionsFor(tela)
      expect(perguntas.length).toBeGreaterThanOrEqual(4)
      expect(perguntas.length).toBeLessThanOrEqual(6)
    }
    expect(thinkingStatus('/app').at(-1)).toBe('Escrevendo a resposta…')
  })

  it('corta o histórico em 20 mensagens sem começar por uma resposta', () => {
    const entries: ChatEntry[] = Array.from({ length: 19 }, (_, index) => ({
      id: String(index),
      role: 'user',
      content: String(index),
    }))
    expect(toApiMessages(entries, 'x')).toHaveLength(20)
    expect(toApiMessages([], 'x')).toEqual([{ role: 'user', content: 'x' }])
  })

  it('classifica os erros', () => {
    expect(classify(new Error('falhou'))).toEqual({ kind: 'falha', message: 'falhou' })
    expect(storageKey()).toBe('erpia-assistente')
    expect(insightQuestion('Título', 'Sem ponto')).toBe(
      'Sobre "Título": Sem ponto. O que está causando isso e o que você recomenda?',
    )
    expect(insightQuestion('Só título')).toContain('"Só título": O que')
  })
})
