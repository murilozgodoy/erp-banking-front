import { portalKeys } from '../../layout/queries'
import { number } from '../../lib/format'
import type { InventoryMovement, InventoryMovementType } from '../../types'

export const inventoryKey = [...portalKeys.erp, 'inventory'] as const

export function movementsKey(itemId: number) {
  return [...inventoryKey, itemId, 'movements'] as const
}

export const MAX_QUANTIDADE = 1_000_000
export const MAX_MOTIVO = 200

export const TIPO_INFO: Record<
  InventoryMovementType,
  { label: string; campo: string; acao: string; feito: string }
> = {
  ENTRADA: {
    label: 'Entrada',
    campo: 'Quantidade que entra',
    acao: 'Registrar entrada',
    feito: 'Entrada registrada',
  },
  SAIDA: {
    label: 'Saída',
    campo: 'Quantidade que sai',
    acao: 'Registrar saída',
    feito: 'Saída registrada',
  },
  AJUSTE: {
    label: 'Ajuste',
    campo: 'Quantidade contada',
    acao: 'Ajustar estoque',
    feito: 'Estoque ajustado',
  },
}

export function unidades(value: number): string {
  return `${number(value)} un.`
}

/** "12" → 12; vazio, fração ou texto → null. */
export function parseQuantidade(text: string): number | null {
  const limpo = text.replace(/\./g, '').trim()
  if (!/^\d+$/.test(limpo)) return null
  return Number(limpo)
}

/** Saldo depois da movimentação (o que o back grava em `quantidade_final`). */
export function saldoFinal(tipo: InventoryMovementType, atual: number, quantidade: number): number {
  if (tipo === 'ENTRADA') return atual + quantidade
  if (tipo === 'SAIDA') return atual - quantidade
  return quantidade
}

/** Custo médio ponderado de uma entrada com custo (como o back recalcula o item). */
export function custoMedio(
  atual: number,
  custoAtual: number,
  entrada: number,
  custoEntrada: number,
): number {
  const total = atual + entrada
  if (total <= 0) return custoAtual
  return Math.round(((atual * custoAtual + entrada * custoEntrada) / total) * 100) / 100
}

/** Mesmas regras do back, para avisar antes de enviar. `null` = quantidade válida. */
export function erroQuantidade(
  tipo: InventoryMovementType,
  quantidade: number | null,
  disponivel: number,
): string | null {
  if (quantidade === null) {
    return tipo === 'AJUSTE' ? 'Informe quanto foi contado.' : 'Informe a quantidade.'
  }
  if (tipo !== 'AJUSTE' && quantidade <= 0) return 'Informe uma quantidade maior que zero.'
  if (quantidade > MAX_QUANTIDADE) return 'Use no máximo 1.000.000 por movimentação.'
  if (tipo === 'SAIDA' && quantidade > disponivel) return `Disponível: ${unidades(disponivel)}`
  return null
}

export type SituacaoMinimo = 'abaixo' | 'no-minimo' | 'acima'

export function situacaoMinimo(quantidade: number, minimo: number): SituacaoMinimo {
  if (quantidade < minimo) return 'abaixo'
  return quantidade === minimo ? 'no-minimo' : 'acima'
}

/** "+18", "−5" ou "ajuste para 30": o que o movimento fez com o saldo. */
export function quantidadeAssinada(movimento: InventoryMovement): string {
  if (movimento.tipo === 'AJUSTE') return `ajuste para ${number(movimento.quantidade_final)}`
  const sinal = movimento.tipo === 'ENTRADA' ? '+' : '−'
  return `${sinal}${number(movimento.quantidade)}`
}

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "hoje às 14:32", "ontem às 09:10", "há 6 dias". */
export function quandoFoi(iso: string, agora = new Date()): string {
  const data = new Date(iso)
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dias = Math.round((inicio(agora) - inicio(data)) / 86_400_000)
  if (dias <= 0) return `hoje às ${hora.format(data)}`
  if (dias === 1) return `ontem às ${hora.format(data)}`
  return `há ${dias} dias`
}
