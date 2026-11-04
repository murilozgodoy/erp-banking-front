import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { collectErrors, parseBrl, saldoDisponivel } from './helpers.ts'

/**
 * Jornada completa do portal, do cadastro ao perfil, num único navegador: o estado do mock (MSW)
 * vive na memória da página, então os passos rodam em série sobre a mesma aba e nunca recarregam.
 *
 * Troca de membro (`?membro=`): o mock lê o papel da URL a cada requisição, mas o `GET /me` fica
 * 15 s em cache no React Query. O relógio do Playwright (só o `Date`) adianta esse tempo e a URL muda por
 * `history.pushState` (sem recarregar), e a página nova busca o `/me` do outro membro.
 *
 * Cada passo salva um print (`NN-passo.png`) no relatório, para a apresentação.
 */

type Membro = 'dono' | 'admin' | 'financeiro' | 'operador' | 'leitura'

test.describe.serial('Jornada completa do portal', () => {
  let context: BrowserContext
  let page: Page
  let errors: string[]

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
    page = await context.newPage()
    errors = collectErrors(page)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  async function foto(nome: string) {
    const path = test.info().outputPath(`${nome}.png`)
    await page.screenshot({ path, fullPage: false })
    await test.info().attach(nome, { path, contentType: 'image/png' })
  }

  /** Navega pelo menu lateral, como o usuário. */
  async function abrirAba(nome: string | RegExp, heading: string) {
    await page.getByRole('navigation', { name: 'Portal' }).getByRole('link', { name: nome }).click()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }

  /**
   * Adianta só o relógio de parede (`Date`): timers, rAF e as animações seguem no tempo real.
   * `clock.install()` congelaria as animações do motion (sheets invisíveis nos prints).
   */
  let adiantado = 0
  async function adiantar(segundos: number) {
    adiantado += segundos * 1000
    await page.clock.setSystemTime(new Date(Date.now() + adiantado))
  }

  /** Troca a rota sem recarregar a página (o mock perderia o estado). */
  async function irPara(path: string) {
    await page.evaluate(
      `history.pushState(null, '', '${path}'); dispatchEvent(new PopStateEvent('popstate'))`,
    )
  }

  /**
   * Vira outro membro sem recarregar: adianta o cache do `/me`, passa pelo perfil (que busca o
   * `/me` de novo e mostra o papel) e segue para a rota pedida.
   */
  async function comoMembro(membro: Membro, papel: string, path: string, heading: string) {
    await adiantar(31)
    await irPara(`/app/perfil?membro=${membro}`)
    await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Na empresa' }).getByText(papel, { exact: true }),
    ).toBeVisible()
    await irPara(`${path}?membro=${membro}`)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }

  /** Espera a digitação do insight da aba terminar (o cursor some). */
  async function insightDigitado() {
    await expect(page.locator('.insight-caret')).toHaveCount(0, { timeout: 8_000 })
  }

  async function semEsqueletos() {
    await expect(page.locator('main [role="status"][aria-label^="Carregando"]')).toHaveCount(0)
  }

  test('1. onboarding do zero até a aprovação', async () => {
    await page.goto('/app?perfil=cliente&mock=nao_iniciado')
    await expect(page).toHaveURL(/\/app\/onboarding/)
    const passo = page.locator('#passo-titulo')
    const continuar = page.getByRole('button', { name: 'Continuar' })

    await expect(passo).toHaveText('Dados da empresa')
    await page.getByLabel('Razão social').fill('Aurora Pães e Confeitaria Ltda')
    await page.getByLabel('Nome fantasia').fill('Aurora Pães')
    await page.getByLabel('CNPJ').fill('11222333000181')
    await page.getByLabel('E-mail').fill('financeiro@aurorapaes.com.br')
    await page.getByLabel('Telefone').fill('19991234567')
    await page.getByLabel('Cidade').fill('Campinas')
    await page.getByLabel('Estado').selectOption('SP')
    await page.getByLabel('Ano de fundação').fill('2016')
    await page.getByLabel('Funcionários').fill('12')
    await foto('01a-onboarding-empresa')
    await continuar.click()

    await expect(passo).toHaveText('Segmento do negócio')
    await page.getByText('Serviços', { exact: true }).click()
    await continuar.click()

    await expect(passo).toHaveText('Como o negócio funciona')
    await page.getByLabel('Faturamento médio mensal').fill('85.000,00')
    await page.getByLabel('% da receita em contratos recorrentes').fill('60')
    await page.getByLabel('% das vendas no cartão de crédito').fill('15')
    await page.getByLabel('Prazo médio de recebimento (dias)').fill('30')
    await page
      .getByRole('group', { name: /Trabalha com estoque/ })
      .getByText('Não', { exact: true })
      .click()
    await page.getByLabel('Margem bruta').fill('45')
    await page.getByLabel('Total de dívidas (empréstimos e financiamentos)').fill('40.000,00')
    await continuar.click()

    await expect(passo).toHaveText('Observações e revisão')
    await expect(page.getByText('11.222.333/0001-81')).toBeVisible()
    await page
      .getByLabel('Observações sobre o negócio')
      .fill('Padaria com encomendas corporativas; dezembro é o melhor mês.')
    await foto('01b-onboarding-revisao')
    await page.getByRole('button', { name: 'Enviar para análise' }).click()

    await expect(page).toHaveURL(/\/app\/status/)
    await expect(
      page.getByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeVisible()
    await foto('01c-em-analise')

    // O mock aprova ~8 s após o envio: o relógio adianta e o polling do status vê a aprovação.
    await adiantar(10)
    await expect(page.getByRole('heading', { name: 'Cadastro aprovado' })).toBeVisible()
    await expect(page).toHaveURL(/\/app$/)
  })

  test('2. visão geral: leitura, indicadores e caixa projetado', async () => {
    const leitura = page.getByRole('region', { name: /Leitura da/ })
    await expect(leitura).toBeVisible()
    await expect(leitura.locator('#leitura-erpia-resumo')).not.toBeEmpty()

    const kpis = page.getByRole('region', { name: 'Indicadores da empresa' })
    for (const label of ['Receita 30 dias', 'Recebíveis 90 dias', 'A pagar 30 dias']) {
      await expect(kpis.getByText(label, { exact: true })).toBeVisible()
    }
    // Gráfico com nome acessível e a tabela equivalente para leitores de tela.
    await expect(
      page.getByRole('img', { name: 'Caixa projetado nos próximos 60 dias' }),
    ).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Caixa projetado nos próximos 60 dias' }),
    ).toBeAttached()
    await semEsqueletos()
    await foto('02-visao-geral')
  })

  test('3. recebíveis: seleciona, simula e antecipa', async () => {
    await abrirAba(/^Recebíveis/, 'Recebíveis')
    const tabela = page.getByRole('table', { name: 'Recebíveis' })
    const marcaveis = tabela.locator('tbody').getByRole('checkbox', { disabled: false })
    await marcaveis.nth(0).check()
    await marcaveis.nth(1).check()

    const selecao = page.getByRole('region', { name: 'Seleção para antecipação' })
    await expect(selecao.getByText('2 recebíveis')).toBeVisible()
    await insightDigitado()
    await foto('03a-recebiveis-selecao')
    await selecao.getByRole('button', { name: 'Simular antecipação' }).click()

    const sheet = page.getByRole('dialog', { name: 'Simular antecipação' })
    await expect(sheet.getByText('CET')).toBeVisible()
    await foto('03b-antecipacao-simulada')
    await sheet.getByRole('button', { name: /^(Contratar|Enviar para análise)$/ }).click()

    const resultado = page.getByRole('dialog', { name: 'Antecipação' })
    await expect(resultado.getByText(/Aprovado|Em análise/).first()).toBeVisible()
    await foto('03c-antecipacao-resultado')
    await resultado.getByRole('button', { name: 'Concluir' }).click()
    await expect(selecao).toBeHidden()
  })

  test('4a. pagamentos: paga um boleto das contas a pagar', async () => {
    await abrirAba(/^Pagamentos/, 'Pagamentos')
    const contas = page.getByRole('region', { name: 'Contas a pagar' })
    const pagar = contas.getByRole('button', { name: /^Pagar / })
    await expect(pagar.first()).toBeVisible()

    // A primeira conta com linha digitável (boleto) que o saldo de hoje cobre.
    const saldo = await saldoDisponivel(page)
    const total = await pagar.count()
    let sheet = page.getByRole('dialog')
    let achou = false
    for (let i = 0; i < total && !achou; i++) {
      await pagar.nth(i).click()
      sheet = page.getByRole('dialog', { name: /^Pagar / })
      await expect(sheet).toBeVisible()
      const boleto = await sheet.getByRole('radio', { name: 'Boleto' }).isChecked()
      const valor = parseBrl(await sheet.getByLabel('Valor', { exact: false }).inputValue())
      achou = boleto && valor <= saldo
      if (!achou) {
        await sheet.getByRole('button', { name: 'Cancelar' }).click()
        await expect(sheet).toBeHidden()
      }
    }
    expect(achou, 'nenhum boleto em aberto cabe no saldo').toBe(true)

    await expect(sheet.getByLabel('Linha digitável')).not.toHaveValue('')
    await sheet.getByRole('button', { name: 'Revisar pagamento' }).click()
    await foto('04a-boleto-confirmacao')
    await sheet.getByRole('button', { name: /^Confirmar (pagamento|agendamento)$/ }).click()

    const comprovante = sheet.getByRole('region', { name: /Comprovante de/ })
    await expect(comprovante).toBeVisible()
    await expect(comprovante.getByText('Boleto')).toBeVisible()
    await expect(comprovante.getByText('Autenticação', { exact: true })).toBeVisible()
    await foto('04b-boleto-comprovante')
    await sheet.getByRole('button', { name: 'Concluir' }).click()
    await expect(sheet).toBeHidden()
  })

  test('4b. pagamentos: operador acima do limite envia para aprovação', async () => {
    await comoMembro('operador', 'Operador', '/app/pagamentos', 'Pagamentos')
    // Sem aprovar_pagamentos, a bandeja não aparece.
    await expect(page.getByRole('region', { name: /Aguardando aprovação/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Novo pagamento' }).click()
    const sheet = page.getByRole('dialog', { name: 'Novo pagamento' })
    await expect(sheet.getByText(/Seu limite por pagamento é/)).toContainText('2.000,00')
    await sheet.getByRole('radio', { name: 'PIX' }).click()
    await sheet.getByLabel('Nome de quem recebe').fill('Moinho Paulista Ltda')
    await sheet.getByLabel('Chave PIX').fill('financeiro@moinhopaulista.com.br')
    await sheet.getByLabel('Valor', { exact: false }).fill('3.000,00')
    await sheet.getByLabel('Descrição').fill('Farinha de trigo especial')
    await sheet.getByRole('button', { name: 'Revisar pagamento' }).click()

    await expect(sheet.getByRole('note')).toContainText('fica aguardando aprovação')
    await sheet.getByRole('button', { name: 'Enviar para aprovação' }).click()
    await expect(sheet.getByText('Enviado para aprovação')).toBeVisible()
    await expect(sheet.getByText('Pendente de aprovação')).toBeVisible()
    await foto('04c-operador-enviado-para-aprovacao')
    await sheet.getByRole('button', { name: 'Concluir' }).click()

    const historico = page.getByRole('region', { name: 'Histórico de pagamentos' })
    await expect(historico.getByText('Pendente de aprovação').first()).toBeVisible()
    await expect(historico.getByText(/feito por Júlia Santos/).first()).toBeVisible()
  })

  test('5. financeiro aprova o pagamento pendente', async () => {
    await comoMembro('financeiro', 'Financeiro', '/app/pagamentos', 'Pagamentos')

    const bandeja = page.getByRole('region', { name: /Aguardando aprovação/ })
    await expect(bandeja.getByText('Moinho Paulista Ltda')).toBeVisible()
    await expect(bandeja.getByText(/feito por Júlia Santos/)).toBeVisible()
    await foto('05a-bandeja-aguardando-aprovacao')

    await bandeja
      .getByRole('button', { name: /Aprovar pagamento de .* para Moinho Paulista Ltda/ })
      .click()
    const recibo = page.getByRole('dialog', { name: 'Pagamento aprovado' })
    await expect(recibo.getByText('Pagamento efetivado')).toBeVisible()
    await expect(recibo.getByText('Autenticação', { exact: true })).toBeVisible()
    await foto('05b-pagamento-aprovado')
    await recibo.getByRole('button', { name: 'Concluir' }).click()
    await expect(bandeja.getByText(/aprovado e debitado/)).toBeVisible()
  })

  test('6a. crédito: financeiro (só pedir_credito) deixa a proposta aguardando contratação', async () => {
    await abrirAba(/^Crédito/, 'Crédito')
    await page.getByRole('radio', { name: /Capital de giro/i }).click()
    const simulador = page.getByRole('region', { name: /Simular capital de giro/i })
    await simulador.getByLabel('Valor', { exact: false }).first().fill('10.000,00')
    await simulador.getByRole('radio', { name: '12x' }).click()
    await expect(simulador.getByText(/Parcela mensal · 12x/)).toBeVisible()
    await expect(simulador.getByText('Pré-aprovado').first()).toBeVisible()
    await simulador.getByRole('button', { name: 'Enviar proposta para contratação' }).click()

    const sheet = page.getByRole('dialog', { name: 'Enviar proposta' })
    await expect(sheet.getByText('CET')).toBeVisible()
    await sheet.getByRole('button', { name: 'Enviar proposta para contratação' }).click()
    const resultado = page.getByRole('dialog', { name: 'Contratação' })
    await expect(resultado.getByText('Proposta enviada para contratação')).toBeVisible()
    await expect(resultado.getByText('Aguardando contratação')).toBeVisible()
    await foto('06a-credito-aguardando-contratacao')
    await resultado.getByRole('button', { name: 'Concluir' }).click()
    await expect(resultado).toBeHidden()

    // Sem contratar_credito, o "Contratar" da proposta fica travado com o motivo.
    const propostas = page.getByRole('table', { name: 'Propostas e contratos de crédito' })
    await expect(propostas.getByText('Aguardando contratação').first()).toBeVisible()
    await expect(
      propostas.getByRole('button', { name: /^Contratar a proposta nº/ }).first(),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  test('6b. crédito: o dono contrata a proposta pendente', async () => {
    await comoMembro('dono', 'Dono', '/app/credito', 'Crédito')
    const propostas = page.getByRole('table', { name: 'Propostas e contratos de crédito' })
    const contratar = propostas.getByRole('button', { name: /^Contratar a proposta nº/ }).first()
    await expect(contratar).not.toHaveAttribute('aria-disabled', 'true')
    await contratar.click()

    const sheet = page.getByRole('dialog', { name: 'Contratar proposta' })
    await expect(sheet.getByText('R$ 10.000,00').first()).toBeVisible()
    await foto('06b-credito-contratar-proposta')
    await sheet.getByRole('button', { name: 'Confirmar contratação' }).click()

    const resultado = page.getByRole('dialog', { name: 'Contratação' })
    await expect(resultado.getByText('Crédito contratado')).toBeVisible()
    await foto('06c-credito-contratado')
    await resultado.getByRole('button', { name: 'Concluir' }).click()
    await expect(resultado).toBeHidden()
    await expect(propostas.getByText('Aguardando contratação')).toHaveCount(0)
  })

  test('7. estoque: saída acima do saldo é barrada e a entrada vai para o histórico', async () => {
    await abrirAba(/^Estoque/, 'Estoque')
    await page
      .getByRole('button', { name: /^Movimentar / })
      .first()
      .click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('tab', { name: 'Movimentar' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const item = (await sheet.locator('h2').first().innerText()).trim()
    const tipo = sheet.getByRole('radiogroup', { name: 'Tipo' })

    await tipo.getByRole('radio', { name: 'Saída' }).click()
    const dica = await sheet.getByText(/^Disponível: [\d.]+ un\.$/).innerText()
    const disponivel = Number(dica.replace(/\D/g, ''))
    const saida = sheet.getByLabel('Quantidade que sai')
    await saida.fill(String(disponivel + 10))
    await expect(saida).toHaveAttribute('aria-invalid', 'true')
    await expect(sheet.getByText(dica, { exact: true })).toBeVisible()
    await foto('07a-estoque-saida-acima-do-saldo')

    await tipo.getByRole('radio', { name: 'Entrada' }).click()
    await sheet.getByLabel('Quantidade que entra').fill('12')
    await sheet.getByLabel('Motivo').fill('Nota fiscal 4512')
    await sheet.getByRole('button', { name: 'Registrar entrada' }).click()
    await expect(sheet.getByText('Entrada registrada')).toBeVisible()
    await expect(sheet.getByText(`${item} agora tem`)).toBeVisible()
    await foto('07b-estoque-entrada-registrada')

    await sheet.getByRole('tab', { name: 'Histórico' }).click()
    const historico = sheet.getByRole('region', { name: `Histórico de ${item}` })
    await expect(historico.getByText('Nota fiscal 4512')).toBeVisible()
    await foto('07c-estoque-historico')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('8. equipe: convida, edita e respeita a hierarquia', async () => {
    await abrirAba(/^Equipe/, 'Equipe')
    const pessoas = page.getByRole('table', { name: /Pessoas da equipe/ })
    await expect(pessoas.getByText('Marina Costa')).toBeVisible()

    await page.getByRole('button', { name: 'Convidar pessoa' }).click()
    const convite = page.getByRole('dialog', { name: 'Convidar pessoa' })
    await convite.getByLabel('Nome', { exact: false }).fill('Beatriz Nunes')
    await convite.getByLabel('E-mail', { exact: false }).fill('beatriz@aurorapaes.com.br')
    await convite.getByText('Administrador', { exact: true }).click()
    await expect(convite.getByRole('radio', { name: /Administrador/ })).toBeChecked()
    await foto('08a-equipe-convite')
    await convite.getByRole('button', { name: 'Criar convite' }).click()

    const criado = page.getByRole('dialog', { name: 'Convite criado' })
    await expect(criado.getByText('Beatriz Nunes pode entrar como Administrador')).toBeVisible()
    await expect(criado.getByLabel('Link do convite')).toHaveValue(/\/convite\/convite-/)
    await criado.getByRole('button', { name: 'Copiar' }).click()
    await expect(criado.getByRole('button', { name: 'Copiado' })).toBeVisible()
    await foto('08b-equipe-link-do-convite')
    await criado.getByRole('button', { name: 'Concluir' }).click()
    await expect(pessoas.getByText('Beatriz Nunes')).toBeVisible()

    // Editar o limite da operadora.
    await page.getByRole('button', { name: 'Ações para Júlia Santos' }).click()
    await page.getByRole('menuitem', { name: 'Editar acesso' }).click()
    const edicao = page.getByRole('dialog', { name: 'Júlia Santos' })
    await edicao.getByLabel('Paga sem aprovação até', { exact: false }).fill('2.500,00')
    await edicao.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Acesso de Júlia Santos atualizado.')).toBeVisible()
    await expect(
      pessoas.getByRole('row').filter({ hasText: 'Júlia Santos' }).getByText('R$ 2.500,00').first(),
    ).toBeVisible()

    // O dono não tem ações.
    await expect(page.getByRole('button', { name: 'Ações para Marina Costa' })).toHaveCount(0)
    await foto('08c-equipe-editada')

    // Como administrador: papel igual (Beatriz, Administrador) fica travado; abaixo, editável.
    await comoMembro('admin', 'Administrador', '/app/equipe', 'Equipe')
    await expect(pessoas.getByText('Sem ações: o dono não é editável')).toBeAttached()
    await expect(page.getByRole('button', { name: 'Ações para Marina Costa' })).toHaveCount(0)
    const beatriz = pessoas.getByRole('row').filter({ hasText: 'Beatriz Nunes' })
    const trava = beatriz.getByLabel('Sem ações')
    await expect(trava).toBeVisible()
    await trava.focus()
    await expect(beatriz.getByRole('tooltip')).toHaveText('Você só gerencia papéis abaixo do seu.')
    await expect(page.getByRole('button', { name: 'Ações para Rafael Lima' })).toBeVisible()
    await foto('08d-equipe-hierarquia-admin')
  })

  test('9. assistente: Ctrl+K, sugestão, resposta e histórico', async () => {
    await comoMembro('dono', 'Dono', '/app/vendas', 'Vendas')
    await page.keyboard.press('Control+k')
    const assistente = page.getByRole('dialog', { name: 'Assistente ErpIa' })
    await expect(assistente).toBeVisible()
    const sugestao = assistente
      .getByRole('list', { name: 'A partir desta tela' })
      .getByRole('button')
      .first()
    const pergunta = (await sugestao.getAttribute('aria-label')) ?? ''
    await foto('09a-assistente-sugestoes')
    await sugestao.click()

    const conversa = assistente.getByRole('log', { name: 'Conversa com o assistente' })
    await expect(conversa.getByRole('heading', { name: pergunta })).toBeVisible()
    await expect(conversa.getByText('Leitura concluída', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await foto('09b-assistente-leitura-concluida')
    // Depois da leitura, o resumo "· Leitura concluída" e o texto da resposta.
    await expect(conversa.getByText(/· Leitura concluída/)).toBeVisible({ timeout: 10_000 })
    await expect(conversa.locator('article p').first()).not.toBeEmpty()
    await expect(conversa.getByRole('list', { name: 'Próximas perguntas' })).toBeVisible()
    await foto('09c-assistente-resposta')

    await assistente.getByRole('button', { name: 'Conversas' }).click()
    const historico = assistente.getByRole('region', { name: 'Conversas' })
    await expect(historico.getByRole('listitem').first()).toBeVisible()
    await expect(historico.getByRole('button', { name: /Apagar a conversa/ }).first()).toBeVisible()
    await foto('09d-assistente-conversas')
    await assistente.getByRole('button', { name: 'Fechar' }).click()
    await expect(assistente).toBeHidden()
  })

  test('10. perfil: nome, papel e permissões', async () => {
    await page.getByRole('link', { name: 'Meu perfil' }).click()
    await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Conta' }).getByText('Marina Costa'),
    ).toBeVisible()
    const empresa = page.getByRole('region', { name: 'Na empresa' })
    await expect(empresa.getByText('Dono', { exact: true })).toBeVisible()
    await expect(empresa.getByText('Sem limite')).toBeVisible()
    const permissoes = page.getByRole('region', { name: 'O que você pode fazer' })
    await expect(permissoes.getByText(': permitido')).toHaveCount(8)
    await expect(permissoes.getByText('Contratar crédito')).toBeVisible()
    await foto('10-perfil')
  })
})
