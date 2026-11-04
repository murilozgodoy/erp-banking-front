import { expect, type Locator, type Page } from '@playwright/test'

/** Status do onboarding aceitos pelo `?mock=` (src/portal/mocks/db.ts). */
export type MockStatus =
  'nao_iniciado' | 'rascunho' | 'em_analise' | 'analise_manual' | 'aprovado' | 'reprovado'

/**
 * Abre uma rota do portal com o login simulado do cliente e o cenário pedido. Cada teste roda num
 * contexto novo (localStorage vazio) e o `?mock=` regrava o estado do mock: nada vaza entre testes.
 */
export async function openPortal(page: Page, path: string, status: MockStatus = 'aprovado') {
  const separator = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${separator}perfil=cliente&mock=${status}`)
}

/** O valor do "Saldo disponível" na faixa de indicadores de Pagamentos. */
export function saldoLocator(page: Page): Locator {
  return page
    .locator('dl > div')
    .filter({ has: page.getByText('Saldo disponível', { exact: true }) })
    .locator('dd')
    .first()
}

/** Lê o "Saldo disponível" de Pagamentos como número (R$ 1.234,56 → 1234.56). */
export async function saldoDisponivel(page: Page): Promise<number> {
  const valor = saldoLocator(page)
  await expect(valor).toHaveText(/R\$/)
  // O Money repete o valor para leitores de tela: vale a primeira linha.
  return parseBrl((await valor.innerText()).split(/\n/)[0])
}

export function parseBrl(texto: string): number {
  const limpo = texto
    .replace(/[^\d,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return Number(limpo)
}

/** Erros de console e exceções não tratadas da página, para os testes de fumaça. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  // O console só diz "status 422"; a URL ajuda a achar quem falhou.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return errors
}
