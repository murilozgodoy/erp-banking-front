import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { auth0State } from '@/test/auth0'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import * as db from '../../mocks/db'
import { setMembroLogado } from '../../mocks/team'
import { renderPortal, useMockApi } from '../../test/portal'

import { InventoryPage } from './InventoryPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))
vi.setConfig({ testTimeout: 30_000 })

const url = (path: string) => `${env.transactionsApiUrl}${path}`

/** Lista as pendências, para ver o efeito da invalidação depois do movimento. */
function PendenciasProbe() {
  const api = usePortalApi()
  const pendencias = useQuery({
    queryKey: [...portalKeys.erp, 'pendencias'],
    queryFn: api.erp.pendencias,
  })
  return (
    <ul aria-label="Pendências">
      {pendencias.data?.map((p) => (
        <li key={p.id}>{p.titulo}</li>
      ))}
    </ul>
  )
}

function open(route = '/app/estoque') {
  return renderPortal(
    <>
      <InventoryPage />
      <PendenciasProbe />
    </>,
    { route, path: '/app/estoque' },
  )
}

/** Item semeado: Panetone (id 1), abaixo do mínimo e com histórico. */
function panetone() {
  return db.estoque().itens.find((item) => item.sku === 'PANETONE-ART')!
}

async function abrirMovimentar(nome: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: `Movimentar ${nome}` }))
  const dialog = await screen.findByRole('dialog', { name: nome })
  return { user, dialog }
}

describe('Movimentar estoque', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })
  afterEach(() => setMembroLogado(null))

  it('sem gerenciar_estoque: botão travado com o motivo e histórico só para leitura', async () => {
    setMembroLogado('LEITURA')
    const user = userEvent.setup()
    const item = panetone()
    open()
    await screen.findByRole('button', { name: `Movimentar ${item.nome}` })
    await waitFor(
      () =>
        expect(screen.getByRole('button', { name: `Movimentar ${item.nome}` })).toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      { timeout: 5000 },
    )
    const botao = screen.getByRole('button', { name: `Movimentar ${item.nome}` })
    expect(botao).toHaveAccessibleDescription(
      'Peça a um administrador a permissão de gerenciar o estoque.',
    )
    await user.click(botao)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `${item.nome}, ver histórico` }))
    const dialog = await screen.findByRole('dialog', { name: item.nome })
    expect(within(dialog).queryByRole('tablist')).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('Para movimentar, peça a um administrador')
    expect(await within(dialog).findByText('Contagem de fim de semana: 2 avariados')).toBeVisible()
  })

  it('com a permissão: entrada com custo mostra a prévia, registra e tira a pendência', async () => {
    const item = panetone()
    open()
    const pendencias = screen.getByRole('list', { name: 'Pendências' })
    expect(await within(pendencias).findByText(`${item.nome} abaixo do mínimo`)).toBeVisible()

    const { user, dialog } = await abrirMovimentar(item.nome)
    expect(dialog).toHaveTextContent(`PANETONE-ART · ${item.quantidade} un. em estoque`)
    const previa = within(dialog).getByRole('region', { name: 'Prévia do saldo' })

    await user.type(within(dialog).getByLabelText('Quantidade que entra'), '200')
    expect(previa).toHaveTextContent(`${item.quantidade} un.${item.quantidade + 200} un.`)
    expect(within(previa).getByText('Acima do mínimo')).toBeVisible()
    expect(within(dialog).getByText(/Atualiza o custo médio/)).toBeVisible()

    await user.type(within(dialog).getByLabelText('Custo unitário'), '30')
    expect(within(previa).getByText('Custo médio')).toBeVisible()
    expect(previa).toHaveTextContent('R$ 29,17')

    await user.type(within(dialog).getByLabelText('Motivo'), 'NF 4512')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }))
    const status = await within(dialog).findByRole('status')
    expect(status).toHaveTextContent('Entrada registrada')
    expect(status).toHaveTextContent(`${item.nome} agora tem 276 un. em estoque.`)
    expect(status).toHaveTextContent('R$ 29,17')

    // A linha, o mock e as pendências refletem o movimento.
    const tabela = screen.getByRole('table', { name: /Itens de estoque/ })
    expect(within(tabela).getByText('276')).toBeInTheDocument()
    expect(panetone()).toMatchObject({
      quantidade: 276,
      custo_unitario: 29.17,
      abaixo_minimo: false,
    })
    await waitFor(() =>
      expect(within(pendencias).queryByText(`${item.nome} abaixo do mínimo`)).toBeNull(),
    )

    await user.click(within(dialog).getByRole('tab', { name: 'Histórico' }))
    const historico = await within(dialog).findByRole('region', {
      name: `Histórico de ${item.nome}`,
    })
    const primeiro = within(historico).getAllByRole('listitem')[0]
    expect(primeiro).toHaveTextContent('Entrada+200')
    expect(primeiro).toHaveTextContent('76 un. → 276 un. · a R$ 30,00/un.')
    expect(primeiro).toHaveTextContent('NF 4512')
    expect(primeiro).toHaveTextContent(/por Marina Costa · hoje às/)

    await user.click(within(dialog).getByRole('tab', { name: 'Movimentar' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('saída: bloqueia acima do disponível no cliente e registra dentro dele', async () => {
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.click(within(dialog).getByRole('radio', { name: 'Saída' }))
    const campo = within(dialog).getByLabelText('Quantidade que sai')
    expect(campo).toHaveAccessibleDescription(`Disponível: ${item.quantidade} un.`)
    await user.type(campo, '999')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription(`Disponível: ${item.quantidade} un.`)
    expect(within(dialog).queryByLabelText('Custo unitário')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Registrar saída' }))
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
    expect(panetone().quantidade).toBe(item.quantidade)

    await user.clear(campo)
    await user.type(campo, '6')
    const previa = within(dialog).getByRole('region', { name: 'Prévia do saldo' })
    expect(within(previa).getByText('Abaixo do mínimo')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Registrar saída' }))
    expect(await within(dialog).findByText('Saída registrada')).toBeVisible()
    expect(panetone().quantidade).toBe(item.quantidade - 6)
  })

  it('ajuste: o contado vira o saldo; "Nova movimentação" volta ao formulário', async () => {
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.click(within(dialog).getByRole('radio', { name: 'Ajuste' }))
    const campo = within(dialog).getByLabelText('Quantidade contada')
    await user.type(campo, '240')
    const previa = within(dialog).getByRole('region', { name: 'Prévia do saldo' })
    expect(previa).toHaveTextContent('240 un.')
    expect(within(previa).getByText('No mínimo')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Ajustar estoque' }))
    expect(await within(dialog).findByText('Estoque ajustado')).toBeVisible()
    expect(panetone()).toMatchObject({ quantidade: 240, abaixo_minimo: false })

    await user.click(within(dialog).getByRole('button', { name: 'Nova movimentação' }))
    expect(within(dialog).getByLabelText('Quantidade contada')).toHaveValue('')
    expect(within(dialog).getByRole('radio', { name: 'Ajuste' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('pede a quantidade antes de enviar; o passo + e − ajusta o número', async () => {
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }))
    expect(within(dialog).getByText('Informe a quantidade.')).toBeVisible()
    const campo = within(dialog).getByLabelText('Quantidade que entra')
    const menos = within(dialog).getByRole('button', { name: 'Diminuir 1' })
    expect(menos).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Aumentar 1' }))
    await user.click(within(dialog).getByRole('button', { name: 'Aumentar 1' }))
    await user.click(menos)
    expect(campo).toHaveValue('1')
    await user.type(campo, 'x')
    expect(campo).toHaveValue('1')

    await user.type(within(dialog).getByLabelText('Motivo'), 'a'.repeat(170))
    expect(within(dialog).getByText('170/200 caracteres')).toBeVisible()
  })

  it('ESTOQUE_INSUFICIENTE do servidor vira erro no campo com o disponível', async () => {
    server.use(
      http.post(url('/me/inventory/:id/movements'), () =>
        HttpResponse.json(
          { error: 'ESTOQUE_INSUFICIENTE', message: 'Saldo insuficiente.', disponivel: 3 },
          { status: 422 },
        ),
      ),
    )
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.click(within(dialog).getByRole('radio', { name: 'Saída' }))
    const campo = within(dialog).getByLabelText('Quantidade que sai')
    await user.type(campo, '5')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(campo).toHaveAccessibleDescription('Disponível: 3 un.'))
    // Mexer no campo limpa o erro do servidor.
    await user.type(campo, '0')
    expect(campo).toHaveAccessibleDescription(`Disponível: ${item.quantidade} un.`)
  })

  it.each([
    [
      404,
      { error: 'ITEM_NAO_ENCONTRADO', message: 'Item não encontrado.' },
      'Este item não está mais no estoque da empresa. Feche e atualize a lista para conferir.',
    ],
    [
      403,
      { error: 'SEM_PERMISSAO', permissao: 'gerenciar_estoque' },
      'Peça a um administrador a permissão de gerenciar o estoque.',
    ],
    [
      400,
      {
        error: 'validation_failed',
        message: 'Dados inválidos.',
        campos: { tipo: 'Tipo inválido.' },
      },
      'Tipo inválido.',
    ],
    [400, { error: 'validation_failed', message: 'Dados inválidos.' }, 'Dados inválidos.'],
    [
      503,
      { error: 'ERRO_INTERNO' },
      'Um serviço dependente está indisponível. Tente novamente em instantes.',
    ],
  ])('erro %i vira uma mensagem calma', async (status, body, mensagem) => {
    server.use(
      http.post(url('/me/inventory/:id/movements'), () => HttpResponse.json(body, { status })),
    )
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.type(within(dialog).getByLabelText('Quantidade que entra'), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(mensagem)
  })

  it('400 com campos marca o campo certo', async () => {
    server.use(
      http.post(url('/me/inventory/:id/movements'), () =>
        HttpResponse.json(
          {
            error: 'validation_failed',
            message: 'Dados inválidos.',
            campos: { motivo: 'Use até 200 caracteres.', custo_unitario: 'Custo inválido.' },
          },
          { status: 400 },
        ),
      ),
    )
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.type(within(dialog).getByLabelText('Quantidade que entra'), '5')
    await user.type(within(dialog).getByLabelText('Custo unitário'), '10')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Motivo')).toHaveAccessibleDescription(
        'Use até 200 caracteres.',
      ),
    )
    expect(within(dialog).getByLabelText('Custo unitário')).toHaveAccessibleDescription(
      'Custo inválido.',
    )
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('custo zero não é enviado', async () => {
    const item = panetone()
    open()
    const { user, dialog } = await abrirMovimentar(item.nome)
    await user.type(within(dialog).getByLabelText('Quantidade que entra'), '5')
    await user.type(within(dialog).getByLabelText('Custo unitário'), '0')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }))
    expect(within(dialog).getByLabelText('Custo unitário')).toHaveAccessibleDescription(
      'Informe um custo maior que zero.',
    )
    expect(panetone().quantidade).toBe(item.quantidade)
  })

  it('histórico: lista com sinal e autor, vazio que ensina e erro com nova tentativa', async () => {
    const item = panetone()
    const semHistorico = db.estoque().itens.find((i) => i.id === 10)!
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: `Histórico de ${item.nome}` }))
    let dialog = await screen.findByRole('dialog', { name: item.nome })
    expect(within(dialog).getByRole('tab', { name: 'Histórico' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const historico = await within(dialog).findByRole('region', {
      name: `Histórico de ${item.nome}`,
    })
    const itens = within(historico).getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(itens[0]).toHaveTextContent(`Ajusteajuste para ${item.quantidade}`)
    expect(itens[0]).toHaveTextContent('por Júlia Santos · há 2 dias')
    expect(itens[1]).toHaveTextContent('Compra do fornecedor')
    expect(itens[1]).toHaveTextContent('há 6 dias')
    expect(historico).toHaveTextContent('2 movimentações, da mais recente para a mais antiga.')

    // Setas trocam de aba.
    within(dialog).getByRole('tab', { name: 'Histórico' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(within(dialog).getByRole('tab', { name: 'Movimentar' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: `Histórico de ${semHistorico.nome}` }))
    dialog = await screen.findByRole('dialog', { name: semHistorico.nome })
    expect(await within(dialog).findByText('Nenhuma movimentação registrada ainda.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    server.use(
      http.get(url('/me/inventory/:id/movements'), () =>
        HttpResponse.json({ detail: 'Serviço fora do ar.' }, { status: 503 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: `${item.nome}, ver histórico` }))
    dialog = await screen.findByRole('dialog', { name: item.nome })
    const erro = await within(dialog).findByRole('alert')
    expect(erro).toHaveTextContent('Não conseguimos carregar o histórico')
    server.resetHandlers()
    await user.click(within(erro).getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await within(dialog).findByRole('region', { name: `Histórico de ${item.nome}` }),
    ).toBeVisible()
  })

  it('?sku=X&movimentar=1 (vindo de uma pendência) já abre a movimentação do item', async () => {
    const item = panetone()
    open('/app/estoque?sku=PANETONE-ART&movimentar=1')
    const dialog = await screen.findByRole('dialog', { name: item.nome })
    expect(within(dialog).getByRole('tab', { name: 'Movimentar' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/Destacando/)).toHaveTextContent(`Destacando ${item.nome}`)
    const user = userEvent.setup()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // O destaque continua; só o "abrir movimentação" sai da URL.
    expect(screen.getByText(/Destacando/)).toBeVisible()
  })
})

describe('mock de movimentação (contrato)', () => {
  useMockApi('APROVADO')

  it('valida o corpo como o back', () => {
    const erro = (body: Parameters<typeof db.movimentarEstoque>[1]) => {
      const r = db.movimentarEstoque(1, body)
      return r.tipo === 'erro' ? r : null
    }
    expect(erro({ tipo: 'X' as never, quantidade: 1 })?.body.campos).toHaveProperty('tipo')
    expect(erro({ tipo: 'ENTRADA', quantidade: 1.5 })?.body.campos).toHaveProperty('quantidade')
    expect(erro({ tipo: 'ENTRADA', quantidade: 0 })?.body.campos).toHaveProperty('quantidade')
    expect(erro({ tipo: 'AJUSTE', quantidade: -1 })?.body.campos).toHaveProperty('quantidade')
    expect(erro({ tipo: 'SAIDA', quantidade: 2_000_000 })?.body.campos).toHaveProperty('quantidade')
    expect(
      erro({ tipo: 'ENTRADA', quantidade: 1, motivo: 'x'.repeat(201) })?.body.campos,
    ).toHaveProperty('motivo')
    expect(
      erro({ tipo: 'ENTRADA', quantidade: 1, motivo: 3 as never })?.body.campos,
    ).toHaveProperty('motivo')
    expect(erro({ tipo: 'SAIDA', quantidade: 1, custo_unitario: 2 })?.body.campos).toHaveProperty(
      'custo_unitario',
    )
    expect(erro({ tipo: 'ENTRADA', quantidade: 1, custo_unitario: 0 })?.body.campos).toHaveProperty(
      'custo_unitario',
    )
    expect(db.movimentarEstoque(999, { tipo: 'ENTRADA', quantidade: 1 })).toMatchObject({
      http: 404,
      body: { error: 'ITEM_NAO_ENCONTRADO' },
    })
    const q = panetone().quantidade
    expect(db.movimentarEstoque(1, { tipo: 'SAIDA', quantidade: q + 1 })).toMatchObject({
      http: 422,
      body: { error: 'ESTOQUE_INSUFICIENTE', disponivel: q },
    })
    expect(db.movimentosEstoque(999)).toBeNull()
  })

  it('zera com ajuste e grava o histórico do mais novo para o mais antigo', () => {
    const r = db.movimentarEstoque(4, { tipo: 'AJUSTE', quantidade: 0, motivo: '  ' })
    expect(r.tipo).toBe('ok')
    if (r.tipo !== 'ok') return
    expect(r.resposta.item).toMatchObject({ quantidade: 0, cobertura_dias: 0 })
    expect(r.resposta.movimento).toMatchObject({ motivo: null, custo_unitario: null })
    db.movimentarEstoque(4, { tipo: 'ENTRADA', quantidade: 3 })
    const lista = db.movimentosEstoque(4)!
    expect(lista.map((m) => m.tipo)).toEqual(['ENTRADA', 'AJUSTE'])
    expect(lista[0]).toMatchObject({ quantidade_anterior: 0, quantidade_final: 3 })
  })
})
