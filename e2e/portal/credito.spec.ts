import { expect, test } from '@playwright/test'

import { collectErrors, openPortal } from './helpers.ts'

test('simula capital de giro, contrata e vê a proposta na lista', async ({ page }) => {
  const errors = collectErrors(page)
  await openPortal(page, '/app/credito?produto=CAPITAL_DE_GIRO')
  await expect(page.getByRole('heading', { name: 'Crédito', level: 1 })).toBeVisible()

  const propostas = page.getByRole('table', { name: 'Propostas e contratos de crédito' })
  await expect(propostas).toBeVisible()
  const antes = await propostas.locator('tbody tr').count()

  await page.getByRole('radio', { name: /Capital de giro/i }).click()
  const simulador = page.getByRole('region', { name: /Simular capital de giro/i })
  await expect(simulador).toBeVisible()

  await simulador.getByLabel('Valor', { exact: false }).first().fill('20.000,00')
  await simulador.getByRole('radio', { name: '12x' }).click()

  // Resultado: parcelas, CET e a decisão.
  await expect(simulador.getByText('CET')).toBeVisible()
  await expect(simulador.getByText(/Parcela mensal · 12x/)).toBeVisible()
  await simulador.getByRole('button', { name: /Ver cronograma \(12 parcelas\)/ }).click()
  await expect(simulador.getByRole('table', { name: 'Cronograma de parcelas' })).toBeVisible()
  await expect(simulador.getByText(/Pré-aprovado|Vai para análise/).first()).toBeVisible()

  await simulador.getByRole('button', { name: /^(Contratar|Enviar proposta)$/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Confirmar contratação' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('CET')).toBeVisible()
  await sheet.getByRole('button', { name: /^(Confirmar contratação|Enviar para análise)$/ }).click()

  const resultado = page.getByRole('dialog', { name: 'Contratação' })
  await expect(resultado.getByText(/Aprovado|Em análise/).first()).toBeVisible()
  await resultado.getByRole('button', { name: 'Concluir' }).click()
  await expect(resultado).toBeHidden()

  await expect(propostas.locator('tbody tr')).toHaveCount(antes + 1)
  await expect(propostas.getByText('R$ 20.000,00').first()).toBeVisible()
  expect(errors).toEqual([])
})
