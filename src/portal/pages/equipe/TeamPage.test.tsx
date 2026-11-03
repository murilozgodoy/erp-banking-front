import { useAuth0 } from '@auth0/auth0-react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import * as team from '../../mocks/team'
import { PAPEIS } from '../../team/permissions'
import { renderPortal, useMockApi } from '../../test/portal'
import { TeamPage } from './TeamPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

const O = 'http://onboarding.test'
type User = ReturnType<typeof userEvent.setup>

function renderPage() {
  return renderPortal(<TeamPage />, { route: '/app/equipe', path: '/app/equipe' })
}

function table() {
  return screen.findByRole('table', { name: /Pessoas da equipe/ })
}

async function row(nome: string) {
  const cell = await within(await table()).findByText(nome)
  return cell.closest('tr')!
}

async function openInvite(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Convidar pessoa' }))
  return screen.findByRole('dialog', { name: 'Convidar pessoa' })
}

async function menuAction(user: User, nome: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Ações para ${nome}` }))
  await user.click(screen.getByRole('menuitem', { name: action }))
  return screen.findByRole('dialog', { name: nome })
}

function toggle(dialog: HTMLElement, name: string) {
  return within(dialog).getByRole('switch', { name })
}

describe('TeamPage', () => {
  const server = useMockApi('APROVADO')

  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
  })

  it('lista a equipe: DONO marcado, a própria linha sem ações e permissões em chips +N', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByRole('heading', { name: 'Equipe' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Carregando a equipe…' })).toBeInTheDocument()

    const dono = await row('Marina Costa')
    expect(within(dono).getAllByText('Dono').length).toBeGreaterThan(0)
    expect(within(dono).getByText('você')).toBeInTheDocument()
    expect(within(dono).getByText('Acesso total')).toBeInTheDocument()
    expect(within(dono).getByText('Sem limite')).toBeInTheDocument()
    expect(within(dono).queryByRole('button', { name: /Ações/ })).not.toBeInTheDocument()

    expect(screen.getByText(/4 pessoas · 1 convite pendente/)).toBeInTheDocument()
    const rafael = await row('Rafael Lima')
    expect(within(rafael).getByText('Ver financeiro')).toBeInTheDocument()
    expect(within(rafael).queryByText('Pedir crédito')).not.toBeInTheDocument()
    const mais = within(rafael).getByRole('button', { name: 'Mostrar mais 2 permissões' })
    expect(mais).toHaveTextContent('+2')
    await user.click(mais)
    expect(within(rafael).getByText('Pedir crédito')).toBeInTheDocument()
    expect(mais).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(rafael).getByRole('button', { name: 'Mostrar menos permissões' }))
    expect(within(rafael).queryByText('Pedir crédito')).not.toBeInTheDocument()

    const carlos = await row('Carlos Mendes')
    expect(within(carlos).getAllByText('Convidado').length).toBeGreaterThan(0)
    expect(within(carlos).getAllByText(/expira em \d dias/).length).toBeGreaterThan(0)
    expect(within(carlos).getByText('Não paga')).toBeInTheDocument()
    expect(within(rafael).getByRole('button', { name: 'Ações para Rafael Lima' })).toBeVisible()
  })

  it('convida: o papel aplica o preset, OPERADOR com pagar exige limite e o link é copiável', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openInvite(user)

    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))
    expect(await within(dialog).findByText('Informe o nome da pessoa.')).toBeInTheDocument()
    expect(within(dialog).getByText('Escolha um papel.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText(/^Nome/)).toHaveFocus())

    await user.type(within(dialog).getByLabelText(/^Nome/), 'Bia Rocha')
    await user.type(within(dialog).getByLabelText(/^E-mail/), 'bia@aurorapaes.com.br')
    await user.click(within(dialog).getByRole('radio', { name: /Operador/ }))
    expect(toggle(dialog, 'Pagar')).toHaveAttribute('aria-checked', 'true')
    expect(toggle(dialog, 'Gerenciar estoque')).toHaveAttribute('aria-checked', 'true')
    expect(toggle(dialog, 'Aprovar pagamentos')).toHaveAttribute('aria-checked', 'false')
    expect(within(dialog).getByText('4 de 8')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Sem limite')).not.toBeInTheDocument()
    expect(
      within(dialog).getByText(/fica aguardando aprovação de quem pode aprovar/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))
    const limite = within(dialog).getByLabelText(/Paga sem aprovação até/)
    expect(
      await within(dialog).findByText('Defina até quanto esta pessoa paga sem aprovação.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(limite).toHaveFocus())

    // Sem "pagar", não há limite a definir.
    await user.click(toggle(dialog, 'Pagar'))
    expect(within(dialog).getByText(/não há limite a definir/)).toBeInTheDocument()
    await user.click(toggle(dialog, 'Pagar'))

    // Trocar de papel reaplica o preset.
    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    expect(toggle(dialog, 'Pagar')).toHaveAttribute('aria-checked', 'false')
    await user.click(within(dialog).getByRole('radio', { name: /Administrador/ }))
    expect(within(dialog).getByText('8 de 8')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Sem limite')).toBeChecked()
    await user.click(within(dialog).getByRole('radio', { name: /Operador/ }))

    await user.type(within(dialog).getByLabelText(/Paga sem aprovação até/), '1500')
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))

    const created = await screen.findByRole('dialog', { name: 'Convite criado' })
    expect(within(created).getByText('Bia Rocha pode entrar como Operador')).toBeInTheDocument()
    const link = within(created).getByLabelText('Link do convite')
    expect((link as HTMLInputElement).value).toMatch(/\/convite\/convite-\d+-/)
    expect(within(created).getByText(/o link não aparece de novo/)).toBeInTheDocument()
    expect(within(created).getByText('R$ 1.500,00')).toBeInTheDocument()

    await user.click(within(created).getByRole('button', { name: 'Copiar' }))
    expect(await within(created).findByText('Link copiado')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe((link as HTMLInputElement).value)

    // A lista já mostra o convite.
    expect(await within(await table()).findByText('Bia Rocha')).toBeInTheDocument()

    await user.click(within(created).getByRole('button', { name: 'Convidar outra pessoa' }))
    const again = await screen.findByRole('dialog', { name: 'Convidar pessoa' })
    expect(within(again).getByLabelText(/^Nome/)).toHaveValue('')
    await user.click(within(again).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('não oferece DONO e mostra o 409 EMAIL_JA_CADASTRADO no campo de e-mail', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openInvite(user)
    expect(within(dialog).queryByRole('radio', { name: /Dono/ })).not.toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Nome/), 'Rafael')
    await user.type(within(dialog).getByLabelText(/^E-mail/), 'financeiro@aurorapaes.com.br')
    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))

    const email = within(dialog).getByLabelText(/^E-mail/)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Este e-mail já faz parte da equipe.',
    )
    expect(email).toHaveAccessibleDescription('Este e-mail já faz parte da equipe.')
    await waitFor(() => expect(email).toHaveFocus())
  })

  it('mostra os erros 422 por campo e o 403 de quem tenta conceder além do que tem', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${O}/me/team/invites`, () =>
        HttpResponse.json(
          { error: 'validation_failed', campos: { nome: 'Nome muito curto.' } },
          { status: 422 },
        ),
      ),
    )
    renderPage()
    const dialog = await openInvite(user)
    await user.type(within(dialog).getByLabelText(/^Nome/), 'B')
    await user.type(within(dialog).getByLabelText(/^E-mail/), 'b@aurorapaes.com.br')
    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))
    expect(await within(dialog).findByText('Nome muito curto.')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Revise os campos destacados.')

    server.use(
      http.post(`${O}/me/team/invites`, () =>
        HttpResponse.json({ error: 'SEM_PERMISSAO', permissao: 'pagar' }, { status: 403 }),
      ),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))
    expect(await within(dialog).findByText(/não pode pagar/)).toBeInTheDocument()
  })

  it('quem não é DONO só concede as permissões que tem', async () => {
    team.atualizar(2, { permissoes: [...PAPEIS.FINANCEIRO.permissoes, 'gerenciar_equipe'] })
    team.setMembroLogado('FINANCEIRO')
    const user = userEvent.setup()
    renderPage()
    // A própria linha (Rafael) fica sem ações.
    const rafael = await row('Rafael Lima')
    expect(within(rafael).getByText('você')).toBeInTheDocument()
    expect(within(rafael).queryByRole('button', { name: /Ações/ })).not.toBeInTheDocument()

    const dialog = await openInvite(user)
    // Hierarquia: o próprio papel e os de cima ficam bloqueados.
    expect(within(dialog).getByRole('radio', { name: /Administrador/ })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Financeiro/ })).toBeDisabled()
    expect(
      within(dialog).getByText(/só convida e gerencia papéis abaixo do seu/),
    ).toBeInTheDocument()
    // Operador traz gerenciar_estoque, que o financeiro não tem.
    expect(within(dialog).getByRole('radio', { name: /Operador/ })).toBeDisabled()
    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    expect(toggle(dialog, 'Contratar crédito')).toBeDisabled()
    expect(toggle(dialog, 'Gerenciar estoque')).toBeDisabled()
    expect(toggle(dialog, 'Contratar crédito')).toHaveAccessibleDescription(
      'Você não tem esta permissão para concedê-la.',
    )
    expect(toggle(dialog, 'Pagar')).toBeEnabled()
    expect(toggle(dialog, 'Gerenciar equipe')).toBeEnabled()
    // Com pagar ligado, o limite começa no próprio limite (R$ 20.000) e não pode passar dele.
    await user.click(toggle(dialog, 'Pagar'))
    const limite = within(dialog).getByRole('textbox', { name: /Paga sem aprovação até/ })
    expect(limite).toHaveValue('20.000,00')
    expect(within(dialog).queryByRole('checkbox', { name: 'Sem limite' })).not.toBeInTheDocument()
    await user.clear(limite)
    await user.type(limite, '25000')
    await user.click(within(dialog).getByRole('button', { name: 'Criar convite' }))
    expect(await within(dialog).findByText(/no máximo R\$\s20\.000,00/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Você só concede o que também pode fazer/)).toBeInTheDocument()
  })

  it('ADMIN concede todas as permissões', async () => {
    team.setMembroLogado('ADMIN')
    const user = userEvent.setup()
    renderPage()
    const dialog = await openInvite(user)
    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    for (const sw of within(dialog).getAllByRole('switch')) expect(sw).toBeEnabled()
    // ADMIN não convida outro ADMIN (hierarquia).
    expect(within(dialog).getByRole('radio', { name: /Administrador/ })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Financeiro/ })).toBeEnabled()
  })

  it('sem gerenciar_equipe, explica que a área é de quem gerencia a equipe', async () => {
    team.setMembroLogado('FINANCEIRO')
    renderPage()
    expect(await screen.findByText('Esta área é de quem gerencia a equipe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para a visão geral' })).toHaveAttribute(
      'href',
      '/app',
    )
  })

  it('edita o papel (preset reaplicado com aviso) e salva', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await menuAction(user, 'Rafael Lima', 'Editar acesso')
    expect(within(dialog).getByRole('radio', { name: /Financeiro/ })).toBeChecked()
    expect(within(dialog).getByLabelText(/Paga sem aprovação até/)).toHaveValue('20.000,00')

    await user.click(within(dialog).getByRole('radio', { name: /Leitura/ }))
    expect(
      within(dialog).getByText(/Era Financeiro\. As permissões voltaram ao padrão/),
    ).toBeInTheDocument()
    expect(toggle(dialog, 'Aprovar pagamentos')).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle(dialog, 'Pedir crédito'))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Acesso de Rafael Lima atualizado.')).toBeInTheDocument()
    const rafael = await row('Rafael Lima')
    await waitFor(() => expect(within(rafael).getAllByText('Leitura').length).toBeGreaterThan(0))
    expect(within(rafael).getByText('Pedir crédito')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dispensar aviso' }))
    expect(screen.queryByText('Acesso de Rafael Lima atualizado.')).not.toBeInTheDocument()
  })

  it('suspende e reativa com confirmação dentro do painel', async () => {
    const user = userEvent.setup()
    renderPage()
    let dialog = await menuAction(user, 'Júlia Santos', 'Suspender')
    expect(within(dialog).getByText('Suspender o acesso de Júlia Santos?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Suspender acesso' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText('Acesso de Júlia Santos suspenso.')).toBeInTheDocument()
    const julia = await row('Júlia Santos')
    await waitFor(() => expect(within(julia).getAllByText('Suspenso').length).toBeGreaterThan(0))

    dialog = await menuAction(user, 'Júlia Santos', 'Reativar')
    await user.click(within(dialog).getByRole('button', { name: 'Reativar' }))
    expect(await screen.findByText('Acesso de Júlia Santos reativado.')).toBeInTheDocument()
  })

  it('remove um membro e revoga um convite', async () => {
    const user = userEvent.setup()
    renderPage()
    let dialog = await menuAction(user, 'Carlos Mendes', 'Revogar convite')
    expect(within(dialog).getByText('Revogar este convite?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Revogar convite' }))
    expect(await screen.findByText('O convite de Carlos Mendes foi revogado.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('contador@escritoriomendes.com.br')).toBeNull())

    dialog = await menuAction(user, 'Júlia Santos', 'Remover da equipe')
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }))
    expect(await screen.findByText('Júlia Santos saiu da equipe.')).toBeInTheDocument()
  })

  it('mostra o erro da ação sem fechar o painel', async () => {
    server.use(
      http.delete(`${O}/me/team/:id`, () =>
        HttpResponse.json({ error: 'CONFLITO_CONCORRENTE' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    const dialog = await menuAction(user, 'Júlia Santos', 'Remover da equipe')
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Outra pessoa alterou este acesso agora há pouco',
    )
  })

  it('menu de ações abre pelo teclado e fecha com Esc', async () => {
    const user = userEvent.setup()
    renderPage()
    const button = await screen.findByRole('button', { name: 'Ações para Rafael Lima' })
    button.focus()
    await user.keyboard('{ArrowDown}')
    const menu = screen.getByRole('menu')
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Editar acesso' })).toHaveFocus(),
    )
    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: 'Suspender' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(within(menu).getByRole('menuitem', { name: 'Remover da equipe' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: 'Editar acesso' })).toHaveFocus()
    await user.keyboard('{ArrowUp}{Home}')
    expect(within(menu).getByRole('menuitem', { name: 'Editar acesso' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()

    await user.click(button)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(screen.getByRole('heading', { name: 'Equipe' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('só com o DONO, ensina a convidar a primeira pessoa', async () => {
    server.use(http.get(`${O}/me/team`, () => HttpResponse.json([team.listar()[0]])))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Por enquanto, só você acessa o portal')).toBeInTheDocument()
    expect(screen.getByText(/1 pessoa$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Convidar a primeira pessoa' }))
    expect(await screen.findByRole('dialog', { name: 'Convidar pessoa' })).toBeInTheDocument()
  })

  it('erro ao carregar: mensagem e "Tentar de novo"', async () => {
    server.use(
      http.get(`${O}/me/team`, () => HttpResponse.json({ error: 'X' }, { status: 500 }), {
        once: true,
      }),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Não conseguimos carregar a equipe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await row('Rafael Lima')).toBeInTheDocument()
  })
})
