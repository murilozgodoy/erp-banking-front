import { useAuth0 } from '@auth0/auth0-react'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MotionGlobalConfig } from 'motion/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { COMENTARIO_REPROVACAO, rascunho } from '../../mocks/db'
import { mockServer } from '../../mocks/server'
import { renderPortal, useMockApi } from '../../test/portal'
import type { OnboardingPayload } from '../../types'
import { OnboardingPage } from './OnboardingPage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

// Fluxos longos com userEvent: folga para máquinas carregadas (CI, cobertura).
vi.setConfig({ testTimeout: 60_000 })

const API = 'http://onboarding.test'

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})
// Ao desmontar, o wizard salva o rascunho pendente: espera esse PUT antes do próximo teste
// zerar o mock, para um teste não vazar dados para o outro.
let inflight = 0
mockServer.events.on('request:start', () => {
  inflight++
})
mockServer.events.on('response:mocked', () => {
  inflight--
})
afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await waitFor(() => expect(inflight).toBe(0), { timeout: 5000 })
})
beforeEach(() => {
  vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
})

function renderPage() {
  const user = userEvent.setup()
  const result = renderPortal(<OnboardingPage />, {
    route: '/app/onboarding',
    path: '/app/onboarding',
  })
  return { user, ...result }
}

/** Observa os PUTs sem trocar a resposta do mock. */
function capturePuts(server: ReturnType<typeof useMockApi>) {
  const bodies: OnboardingPayload[] = []
  server.use(
    http.put(`${API}/me/onboarding`, async ({ request }) => {
      bodies.push((await request.clone().json()) as OnboardingPayload)
    }),
  )
  return bodies
}

const heading = (name: string) => screen.findByRole('heading', { level: 2, name })
const location = () => screen.findByTestId('location')

describe('OnboardingPage: cliente novo', () => {
  const server = useMockApi('NAO_INICIADO')

  it('mostra o esqueleto e abre no passo da empresa', async () => {
    renderPage()
    expect(screen.getByRole('status', { name: 'Carregando o cadastro…' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Cadastro da empresa' })).toBeVisible()
    expect(await heading('Dados da empresa')).toBeInTheDocument()
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })

  it('erro ao carregar os segmentos: explica e tenta de novo', async () => {
    server.use(
      http.get(`${API}/onboarding/templates`, () =>
        HttpResponse.json({ detail: 'Serviço fora do ar.' }, { status: 503 }),
      ),
    )
    const { user } = renderPage()
    expect(await screen.findByText('Não conseguimos abrir o seu cadastro')).toBeInTheDocument()
    expect(screen.getByText(/Serviço fora do ar\. O que você já preencheu/)).toBeInTheDocument()
    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await heading('Dados da empresa')).toBeInTheDocument()
  })

  it('erro ao carregar o rascunho também tem retry', async () => {
    server.use(
      http.get(`${API}/me/onboarding`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    const { user } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await heading('Dados da empresa')).toBeInTheDocument()
  })

  it('sem segmentos no catálogo: estado de erro', async () => {
    server.use(http.get(`${API}/onboarding/templates`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText('Os segmentos não estão disponíveis agora')).toBeInTheDocument()
  })

  it('valida a empresa antes de avançar: foco no primeiro erro, máscara e DV do CNPJ', async () => {
    const { user } = renderPage()
    await heading('Dados da empresa')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const razao = screen.getByRole('textbox', { name: /^Razão social/ })
    expect(razao).toHaveFocus()
    expect(razao).toHaveAttribute('aria-invalid', 'true')
    expect(razao).toHaveAccessibleDescription('Campo obrigatório.')

    await user.type(razao, 'Oficina Boa Vista Ltda')
    expect(razao).not.toHaveAttribute('aria-invalid')

    const cnpj = screen.getByRole('textbox', { name: /^CNPJ/ })
    await user.type(cnpj, '11222333000100')
    expect(cnpj).toHaveValue('11.222.333/0001-00')
    await user.tab()
    expect(cnpj).toHaveAccessibleDescription('CNPJ inválido: confira os 14 dígitos.')
    await user.clear(cnpj)
    await user.type(cnpj, '11222333000181')
    await user.tab()
    expect(cnpj).not.toHaveAttribute('aria-invalid')

    const telefone = screen.getByRole('textbox', { name: /^Telefone/ })
    await user.type(telefone, '1132345678')
    expect(telefone).toHaveValue('(11) 3234-5678')
  })

  it('percorre os 4 passos, mostra o campo condicional e envia para análise', async () => {
    const puts = capturePuts(server)
    const { user, queryClient } = renderPage()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    await heading('Dados da empresa')

    await user.type(screen.getByRole('textbox', { name: /^Razão social/ }), 'Loja Boa Vista Ltda')
    await user.type(screen.getByRole('textbox', { name: /^CNPJ/ }), '11222333000181')
    await user.type(screen.getByRole('textbox', { name: /^E-mail/ }), 'fin@boavista.com.br')
    await user.click(screen.getByRole('textbox', { name: /^Telefone/ }))
    await user.paste('11987654321')
    expect(screen.getByRole('textbox', { name: /^Telefone/ })).toHaveValue('(11) 98765-4321')
    await user.type(screen.getByRole('textbox', { name: /^Cidade/ }), 'São Paulo')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Estado/ }), 'SP')
    await user.type(screen.getByRole('textbox', { name: /^Ano de fundação/ }), '2019')
    await user.type(screen.getByRole('textbox', { name: /^Funcionários/ }), '12')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Passo 2: segmento, radiogroup com teclado.
    const segmentoTitulo = await heading('Segmento do negócio')
    await waitFor(() => expect(segmentoTitulo).toHaveFocus())
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Escolha o segmento do negócio.')).toBeInTheDocument()
    const varejo = screen.getByRole('radio', { name: /^Varejo e e-commerce/ })
    await user.click(varejo)
    expect(varejo).toBeChecked()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: /^Alimentação/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /^Varejo e e-commerce/ }))
    expect(screen.getByText(/Próximo passo:/)).toHaveTextContent(
      'Próximo passo: 13 perguntas sobre como você vende, operação, financeiro.',
    )
    expect(screen.getByRole('radio', { name: /^Outro segmento/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Passo 3: perguntas do template de varejo.
    await heading('Como o negócio funciona')
    expect(screen.getByRole('heading', { level: 3, name: 'Como você vende' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^Valor do estoque/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const faturamento = screen.getByRole('textbox', { name: /^Faturamento médio mensal/ })
    expect(faturamento).toHaveFocus()
    await user.type(faturamento, '50000')
    await user.type(
      screen.getByRole('textbox', { name: /^% das vendas no cartão de crédito/ }),
      '40',
    )
    await user.type(screen.getByRole('textbox', { name: /^Parcelamento médio/ }), '3')
    await user.click(screen.getByRole('checkbox', { name: 'Marketplace' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /^Sazonalidade/ }), 'Alta')
    await user.type(screen.getByRole('textbox', { name: /^Prazo médio de recebimento/ }), '30')
    const sim = within(screen.getByRole('group', { name: /^Trabalha com estoque/ })).getByRole(
      'radio',
      { name: 'Sim' },
    )
    await user.click(sim)
    const estoque = await screen.findByRole('textbox', { name: /^Valor do estoque/ })
    expect(estoque).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(estoque).toHaveFocus()
    expect(estoque).toHaveAccessibleDescription('Campo obrigatório.')
    await user.type(estoque, '20000')
    await user.type(screen.getByRole('textbox', { name: /^Margem bruta/ }), '35')
    await user.type(screen.getByRole('textbox', { name: /^Total de dívidas/ }), '10000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Passo 4: observações e revisão.
    await heading('Observações e revisão')
    const resumo = screen.getByRole('region', { name: 'Respostas do segmento' })
    expect(within(resumo).getByText('Marketplace')).toBeInTheDocument()
    expect(within(resumo).getByText('40%')).toBeInTheDocument()
    expect(within(resumo).getByText('Sim')).toBeInTheDocument()
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument()
    expect(screen.getByText('(11) 98765-4321')).toBeInTheDocument()
    expect(screen.getByText('São Paulo / SP')).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: /^Observações sobre o negócio/ }),
      'Dezembro concentra as vendas.',
    )
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))

    expect(await location()).toHaveTextContent('/app/status')
    const envio = puts.find((body) => body.enviar)
    expect(envio).toMatchObject({
      segmento: 'varejo',
      observacoes: 'Dezembro concentra as vendas.',
      empresa: { cnpj: '11222333000181', estado: 'SP', fundacao_ano: 2019, funcionarios: 12 },
      respostas: {
        faturamento_mensal: 50000,
        pct_cartao_credito: 40,
        parcelamento_medio: 3,
        canais: ['Marketplace'],
        sazonalidade: 'Alta',
        prazo_medio_recebimento_dias: 30,
        possui_estoque: true,
        valor_estoque: 20000,
      },
    })
    // Nenhum rascunho depois do envio.
    expect(puts.at(-1)?.enviar).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['portal', 'me'] })
  }, 60_000)
})

describe('OnboardingPage: retomando o rascunho', () => {
  const server = useMockApi('RASCUNHO')

  it('abre no primeiro passo incompleto e volta sem perder dados', async () => {
    const { user } = renderPage()
    expect(await heading('Como o negócio funciona')).toBeInTheDocument()
    expect(screen.getByText('Passo 3 de 4')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Faturamento médio mensal/ })).toHaveValue(
      '182.000,00',
    )
    expect(screen.getByRole('textbox', { name: /^% das vendas por delivery/ })).toHaveValue('28')
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await heading('Segmento do negócio')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Alimentação/ })).toBeChecked()
    // O progresso deixa voltar a qualquer passo já alcançado.
    await user.click(screen.getByRole('button', { name: /^Empresa/ }))
    expect(await heading('Dados da empresa')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Razão social/ })).toHaveValue(
      'Padaria e Confeitaria Aurora Ltda',
    )
    await user.click(screen.getByRole('button', { name: /Perguntas$/ }))
    expect(await heading('Como o negócio funciona')).toBeInTheDocument()
  })

  it('autosave: espera a digitação parar e manda o estado inteiro com enviar=false', async () => {
    const puts = capturePuts(server)
    const { user } = renderPage()
    await heading('Como o negócio funciona')
    const ticket = screen.getByRole('textbox', { name: /^Ticket médio/ })
    await user.clear(ticket)
    await user.type(ticket, '45')
    expect(screen.getByText('Salvando…')).toBeInTheDocument()
    expect(puts).toHaveLength(0)
    expect(await screen.findByText('Salvo há instantes', {}, { timeout: 8000 })).toBeVisible()
    expect(puts).toHaveLength(1)
    expect(puts[0]).toMatchObject({
      enviar: false,
      segmento: 'alimentacao',
      empresa: { razao_social: 'Padaria e Confeitaria Aurora Ltda' },
      respostas: { faturamento_mensal: 182000, ticket_medio: 45, pct_delivery: 28 },
      observacoes: '',
    })
  })

  it('troca de passo salva na hora', async () => {
    const puts = capturePuts(server)
    const { user } = renderPage()
    await heading('Como o negócio funciona')
    await user.type(screen.getByRole('textbox', { name: /^Ticket médio/ }), '0')
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    await waitFor(() => expect(puts).toHaveLength(1))
  })

  it('falha no autosave: avisa e tenta de novo', async () => {
    server.use(
      http.put(`${API}/me/onboarding`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    const { user } = renderPage()
    await heading('Como o negócio funciona')
    await user.type(screen.getByRole('textbox', { name: /^Ticket médio/ }), '0')
    expect(
      await screen.findByText(/Não foi possível salvar/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'tentar de novo' }))
    expect(await screen.findByText('Salvo há instantes')).toBeInTheDocument()
  })

  it('409 no autosave (já enviado em outra aba): vai para o status', async () => {
    server.use(
      http.put(`${API}/me/onboarding`, () =>
        HttpResponse.json({ detail: 'Onboarding já enviado.' }, { status: 409 }),
      ),
    )
    const { user } = renderPage()
    await heading('Como o negócio funciona')
    await user.type(screen.getByRole('textbox', { name: /^Ticket médio/ }), '0')
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(await location()).toHaveTextContent('/app/status')
  })
})

describe('OnboardingPage: reenvio depois da reprovação', () => {
  const server = useMockApi('REPROVADO')

  it('mostra o comentário do analista e abre na revisão', async () => {
    renderPage()
    expect(await heading('Observações e revisão')).toBeInTheDocument()
    expect(screen.getByText('O cadastro anterior não foi aprovado')).toBeInTheDocument()
    expect(screen.getByText(`“${COMENTARIO_REPROVACAO}”`)).toBeInTheDocument()
  })

  it('reaberto como rascunho pela página de status: o comentário continua visível', async () => {
    server.use(
      http.get(`${API}/me/onboarding`, () =>
        HttpResponse.json({
          ...rascunho(),
          onboarding_status: 'RASCUNHO',
          review_comment: 'Faltou explicar a dívida.',
          reviewed_at: '2026-11-02T13:00:00Z',
        }),
      ),
    )
    renderPage()
    await heading('Observações e revisão')
    expect(screen.getByText('“Faltou explicar a dívida.”')).toBeInTheDocument()
    expect(screen.getByText('Comentário do analista em 02 de novembro de 2026:')).toBeVisible()
  })

  it('sem comentário: nota neutra', async () => {
    server.use(
      http.get(`${API}/me/onboarding`, () =>
        HttpResponse.json({ ...rascunho(), review_comment: null }),
      ),
    )
    renderPage()
    await heading('Observações e revisão')
    expect(screen.getByText(/Revise os dados, principalmente os financeiros/)).toBeInTheDocument()
  })

  it('422: leva ao primeiro passo com erro, foca o campo e lista os erros', async () => {
    server.use(
      http.put(`${API}/me/onboarding`, () =>
        HttpResponse.json(
          {
            detail: 'Preencha os campos obrigatórios.',
            campos: [
              { campo: 'ticket_medio', erro: 'Valor fora do padrão do segmento.' },
              { campo: 'empresa.cnpj', erro: 'CNPJ já cadastrado.' },
            ],
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderPage()
    await heading('Observações e revisão')
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))

    expect(await heading('Dados da empresa')).toBeInTheDocument()
    const cnpj = screen.getByRole('textbox', { name: /^CNPJ/ })
    await waitFor(() => expect(cnpj).toHaveFocus())
    expect(cnpj).toHaveAttribute('aria-invalid', 'true')
    expect(cnpj).toHaveAccessibleDescription('CNPJ já cadastrado.')
    const resumo = screen.getByRole('alert')
    expect(resumo).toHaveTextContent('Revise 2 campos antes de enviar')

    await user.click(within(resumo).getByRole('button', { name: /Ticket médio por venda/ }))
    const ticket = await screen.findByRole('textbox', { name: /^Ticket médio/ })
    await waitFor(() => expect(ticket).toHaveFocus())
    expect(ticket).toHaveAccessibleDescription('Valor fora do padrão do segmento.')

    // Corrigir o campo tira o erro do resumo.
    await user.type(ticket, '1')
    expect(screen.getByRole('alert')).toHaveTextContent('Revise 1 campo antes de enviar')
  })

  it('422 sem lista de campos mostra a mensagem do servidor', async () => {
    server.use(
      http.put(`${API}/me/onboarding`, () =>
        HttpResponse.json({ detail: 'Cadastro bloqueado.' }, { status: 422 }),
      ),
    )
    const { user } = renderPage()
    await heading('Observações e revisão')
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    expect(await screen.findByText('Não conseguimos enviar o cadastro')).toBeInTheDocument()
    expect(screen.getByText(/Cadastro bloqueado\. Seus dados continuam salvos/)).toBeVisible()
  })

  it('409 no envio: o cadastro já foi enviado, vai para o status', async () => {
    server.use(http.put(`${API}/me/onboarding`, () => HttpResponse.json({}, { status: 409 })))
    const { user } = renderPage()
    await heading('Observações e revisão')
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    expect(await location()).toHaveTextContent('/app/status')
  })

  it('editar a partir da revisão valida e volta para a revisão', async () => {
    const { user } = renderPage()
    await heading('Observações e revisão')
    await user.click(screen.getByRole('button', { name: 'Editar dados da empresa' }))
    expect(await heading('Dados da empresa')).toBeInTheDocument()
    const razao = screen.getByRole('textbox', { name: /^Razão social/ })
    await user.clear(razao)
    await user.click(screen.getByRole('button', { name: 'Voltar à revisão' }))
    expect(razao).toHaveFocus()
    await user.type(razao, 'Aurora Pães Ltda')
    await user.click(screen.getByRole('button', { name: 'Voltar à revisão' }))
    expect(await heading('Observações e revisão')).toBeInTheDocument()
    expect(screen.getByText('Aurora Pães Ltda')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Trocar o segmento' }))
    expect(await heading('Segmento do negócio')).toBeInTheDocument()
  })

  it('validação local no envio: aponta o campo sem chamar a API', async () => {
    const puts = capturePuts(server)
    const { user } = renderPage()
    await heading('Observações e revisão')
    await user.click(screen.getByRole('button', { name: 'Editar dados da empresa' }))
    const email = await screen.findByRole('textbox', { name: /^E-mail/ })
    await user.clear(email)
    // Pelo progresso dá para pular para a revisão sem validar; o envio valida tudo.
    await user.click(screen.getByRole('button', { name: /Revisão$/ }))
    await user.click(await screen.findByRole('button', { name: 'Enviar para análise' }))
    expect(await heading('Dados da empresa')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^E-mail/ })).toHaveFocus())
    expect(screen.getByRole('alert')).toHaveTextContent('Empresa · E-mail: Campo obrigatório.')
    expect(puts.filter((body) => body.enviar)).toHaveLength(0)
  })
})

describe('OnboardingPage: cadastro já enviado', () => {
  useMockApi('EM_ANALISE')

  it('redireciona para o status', async () => {
    renderPage()
    expect(await location()).toHaveTextContent('/app/status')
  })
})

describe('OnboardingPage: cliente aprovado', () => {
  useMockApi('APROVADO')

  it('redireciona para o portal', async () => {
    renderPage()
    expect(await location()).toHaveTextContent(/^\/app$/)
  })
})
