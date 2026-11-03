import { expect, test } from '@playwright/test'

import { openPortal } from './helpers.ts'

test('cliente novo preenche o cadastro em 4 passos e cai na análise', async ({ page }) => {
  await openPortal(page, '/app', 'nao_iniciado')

  // Sem cadastro, qualquer rota do portal leva ao onboarding.
  await expect(page).toHaveURL(/\/app\/onboarding/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await expect(page.getByRole('navigation', { name: 'Progresso do cadastro' })).toBeVisible()

  const passo = page.locator('#passo-titulo')
  const continuar = page.getByRole('button', { name: 'Continuar' })

  // 1. Empresa
  await expect(passo).toHaveText('Dados da empresa')
  await page.getByLabel('Razão social').fill('Estúdio Linha Reta Design Ltda')
  await page.getByLabel('Nome fantasia').fill('Linha Reta')
  await page.getByLabel('CNPJ').fill('11222333000181')
  await page.getByLabel('E-mail').fill('financeiro@linhareta.com.br')
  await page.getByLabel('Telefone').fill('19991234567')
  await page.getByLabel('Cidade').fill('Campinas')
  await page.getByLabel('Estado').selectOption('SP')
  await page.getByLabel('Ano de fundação').fill('2016')
  await page.getByLabel('Funcionários').fill('12')
  await continuar.click()

  // 2. Segmento
  await expect(passo).toHaveText('Segmento do negócio')
  await page.getByText('Serviços', { exact: true }).click()
  await continuar.click()

  // 3. Perguntas do segmento (seções Como você vende, Operação e Financeiro)
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

  // 4. Observações e revisão
  await expect(passo).toHaveText('Observações e revisão')
  await expect(page.getByText('11.222.333/0001-81')).toBeVisible()
  await page
    .getByLabel('Observações sobre o negócio')
    .fill('Estúdio de design com contratos mensais; dezembro e janeiro são mais fracos.')
  await page.getByRole('button', { name: 'Enviar para análise' }).click()

  await expect(page).toHaveURL(/\/app\/status/)
  await expect(page.getByRole('heading', { name: 'Análise do cadastro' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Estamos analisando sua empresa|Cadastro aprovado/ }),
  ).toBeVisible()
})
