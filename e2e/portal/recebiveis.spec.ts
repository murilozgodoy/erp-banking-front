import { expect, test } from '@playwright/test'

import { collectErrors, openPortal } from './helpers.ts'

test('seleciona recebíveis, simula a antecipação e contrata', async ({ page }) => {
  const errors = collectErrors(page)
  await openPortal(page, '/app/recebiveis')
  await expect(page.getByRole('heading', { name: 'Recebíveis', level: 1 })).toBeVisible()

  const tabela = page.getByRole('table', { name: 'Recebíveis' })
  await expect(tabela).toBeVisible()
  const marcaveis = tabela.locator('tbody').getByRole('checkbox', { disabled: false })
  await marcaveis.nth(0).check()
  await marcaveis.nth(1).check()

  const selecao = page.getByRole('region', { name: 'Seleção para antecipação' })
  await expect(selecao.getByText('2 recebíveis')).toBeVisible()
  await selecao.getByRole('button', { name: 'Simular antecipação' }).click()

  const sheet = page.getByRole('dialog', { name: 'Simular antecipação' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel('Valor a antecipar', { exact: false })).not.toHaveValue('')
  await expect(sheet.getByText('CET')).toBeVisible()

  await sheet.getByRole('button', { name: /^(Contratar|Enviar para análise)$/ }).click()
  const resultado = page.getByRole('dialog', { name: 'Antecipação' })
  await expect(resultado.getByText(/Aprovado|Em análise/).first()).toBeVisible()
  await resultado.getByRole('button', { name: 'Concluir' }).click()

  await expect(resultado).toBeHidden()
  // Contratada, a seleção some.
  await expect(selecao).toBeHidden()
  expect(errors).toEqual([])
})
