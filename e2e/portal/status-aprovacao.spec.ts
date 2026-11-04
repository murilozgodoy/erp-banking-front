import { expect, test } from '@playwright/test'

import { openPortal } from './helpers.ts'

test.describe('Status da análise → aprovação', () => {
  test('em análise mostra o andamento e libera o portal quando o mock aprova', async ({ page }) => {
    // O mock conclui a análise automática ~8 s após o envio (ANALISE_MS) e o status faz polling.
    test.slow()
    await openPortal(page, '/app', 'em_analise')

    // Em análise o portal só abre a página de status.
    await expect(page).toHaveURL(/\/app\/status/)
    await expect(page.getByRole('heading', { name: 'Análise do cadastro' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Estamos analisando sua empresa' }),
    ).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Cadastro aprovado' })).toBeVisible({
      timeout: 30_000,
    })
    // A página leva sozinha à visão geral (ou pelo botão, se o usuário for mais rápido).
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })

    // A faixa de indicadores trocou de nome e o saldo saiu da barra do topo (fica em Pagamentos).
    const kpis = page.getByRole('region', { name: 'Indicadores da empresa' })
    await expect(kpis).toBeVisible()
    for (const label of ['Receita 30 dias', 'Recebíveis 90 dias', 'A pagar 30 dias']) {
      await expect(kpis.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test('aprovado entra direto na visão geral', async ({ page }) => {
    await openPortal(page, '/app/status', 'aprovado')
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
    await expect(page.getByRole('navigation', { name: 'Portal' })).toBeVisible()
  })
})
