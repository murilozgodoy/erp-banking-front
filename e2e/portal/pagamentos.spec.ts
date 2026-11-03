import { expect, test } from '@playwright/test'

import { collectErrors, openPortal, parseBrl } from './helpers.ts'

test('paga um PIX, recebe o comprovante com autenticação e o saldo cai', async ({ page }) => {
  const errors = collectErrors(page)
  await openPortal(page, '/app/pagamentos')
  await expect(page.getByRole('heading', { name: 'Pagamentos', level: 1 })).toBeVisible()

  const saldoTopo = page.getByText('Saldo disponível').first().locator('span.tabular')
  await expect(saldoTopo).toHaveText(/R\$/)
  const saldoAntes = parseBrl(await saldoTopo.innerText())

  await page.getByRole('button', { name: 'Novo pagamento' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo pagamento' })
  await expect(sheet).toBeVisible()

  await sheet.getByRole('radio', { name: 'PIX' }).click()
  await sheet.getByLabel('Nome de quem recebe').fill('Moinho Bom Grão Ltda')
  await sheet.getByLabel('Chave PIX').fill('financeiro@moinhobomgrao.com.br')
  await sheet.getByLabel('Valor', { exact: false }).fill('150,00')
  await sheet.getByLabel('Descrição').fill('Farinha especial')
  await sheet.getByRole('button', { name: 'Revisar pagamento' }).click()

  await expect(sheet.getByText('financeiro@moinhobomgrao.com.br')).toBeVisible()
  await sheet.getByRole('button', { name: 'Confirmar pagamento' }).click()

  const comprovante = sheet.getByRole('region', { name: 'Comprovante de pagamento' })
  await expect(comprovante).toBeVisible()
  await expect(comprovante.getByText('Autenticação')).toBeVisible()
  await expect(comprovante.getByText('Moinho Bom Grão Ltda')).toBeVisible()
  await sheet.getByRole('button', { name: 'Concluir' }).click()
  await expect(sheet).toBeHidden()

  await expect
    .poll(async () => parseBrl(await saldoTopo.innerText()))
    .toBeCloseTo(saldoAntes - 150, 2)
  expect(errors).toEqual([])
})
