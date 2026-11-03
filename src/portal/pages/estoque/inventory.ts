import type { InventoryItem } from '../../types'

/** Capital empatado no item, a preço de custo. */
export function valorEmEstoque(item: InventoryItem): number {
  return item.quantidade * item.custo_unitario
}

/** Quanto custa levar o item de volta ao mínimo (0 se já está no mínimo). */
export function custoReposicao(item: InventoryItem): number {
  return Math.max(0, item.minimo - item.quantidade) * item.custo_unitario
}

export type Filtro = 'todos' | 'abaixo' | 'parados'

export function filtrar(itens: InventoryItem[], filtro: Filtro): InventoryItem[] {
  if (filtro === 'abaixo') return itens.filter((item) => item.abaixo_minimo)
  if (filtro === 'parados') return itens.filter((item) => item.parado)
  return itens
}

export interface FaixaGiro {
  key: string
  label: string
  valor: number
  itens: number
  /** Giro acima de 90 dias: o que o contrato chama de "parado". */
  parado: boolean
}

const FAIXAS = [
  { key: 'ate-30', label: 'até 30 d', max: 30 },
  { key: '31-60', label: '31–60 d', max: 60 },
  { key: '61-90', label: '61–90 d', max: 90 },
  { key: '91-120', label: '91–120 d', max: 120 },
  { key: 'acima-120', label: '120+ d', max: Infinity },
]

/** Valor em estoque por faixa de giro, da que gira mais rápido para a mais lenta. */
export function porFaixaDeGiro(itens: InventoryItem[]): FaixaGiro[] {
  return FAIXAS.map((faixa, index) => {
    const min = index === 0 ? -Infinity : FAIXAS[index - 1].max
    const dentro = itens.filter((item) => item.giro_dias > min && item.giro_dias <= faixa.max)
    return {
      key: faixa.key,
      label: faixa.label,
      valor: dentro.reduce((acc, item) => acc + valorEmEstoque(item), 0),
      itens: dentro.length,
      parado: faixa.max > 90,
    }
  })
}
