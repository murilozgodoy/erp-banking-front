import type { ProdutoCredito } from '../types'

export const PRODUTO_LABEL: Record<ProdutoCredito, string> = {
  ANTECIPACAO_RECEBIVEIS: 'Antecipação de recebíveis',
  CAPITAL_DE_GIRO: 'Capital de giro',
  ALAVANCAGEM: 'Crédito para crescer',
  FINANCIAMENTO_ESTOQUE: 'Financiamento de estoque',
  CONSOLIDACAO_DIVIDAS: 'Consolidação de dívidas',
}

/** Link para o simulador da aba Crédito, já preenchido. */
export function simulatorHref(produto: ProdutoCredito, valor?: number): string {
  const query = new URLSearchParams({ produto })
  if (valor) query.set('valor', String(Math.round(valor)))
  return `/app/credito?${query.toString()}`
}
