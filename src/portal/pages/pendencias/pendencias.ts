import { dayMonth, daysFromToday, relativeDay } from '../../lib/format'
import type { Pendencia, PendenciaTipo } from '../../types'

export type GrupoKey = 'agora' | 'credito' | 'estoque'

export interface Grupo {
  key: GrupoKey
  titulo: string
  descricao: string
  tipos: PendenciaTipo[]
}

/** Grupos por urgência, na mesma ordem de prioridade do servidor. */
export const GRUPOS: Grupo[] = [
  {
    key: 'agora',
    titulo: 'Resolver agora',
    descricao: 'Contas vencidas ou vencendo hoje e o caixa projetado.',
    tipos: ['CONTA_ATRASADA', 'SALDO_INSUFICIENTE', 'VENCE_HOJE'],
  },
  {
    key: 'credito',
    titulo: 'Crédito',
    descricao: 'Propostas em andamento e limites disponíveis para usar.',
    tipos: ['PROPOSTA_CREDITO'],
  },
  {
    key: 'estoque',
    titulo: 'Estoque',
    descricao: 'Itens para repor e capital parado na prateleira.',
    tipos: ['ESTOQUE_BAIXO', 'ESTOQUE_PARADO'],
  },
]

const ORDEM: PendenciaTipo[] = GRUPOS.flatMap((grupo) => grupo.tipos)

export function grupoDe(tipo: PendenciaTipo): GrupoKey {
  return GRUPOS.find((grupo) => grupo.tipos.includes(tipo))?.key ?? 'agora'
}

/** Agrupa mantendo a ordem do servidor dentro de cada tipo. */
export function agrupar(lista: Pendencia[]): { grupo: Grupo; itens: Pendencia[] }[] {
  return GRUPOS.map((grupo) => ({
    grupo,
    itens: lista
      .filter((p) => grupo.tipos.includes(p.tipo))
      .sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo)),
  }))
}

/** Data da pendência na linguagem do tipo: "venceu 28 out · há 6 dias", "vence hoje". */
export function quando(p: Pendencia, today = new Date()): string {
  const dias = daysFromToday(p.data, today)
  const relativo = relativeDay(p.data, today)
  switch (p.tipo) {
    case 'CONTA_ATRASADA':
      return `venceu ${dayMonth(p.data)} · ${relativo}`
    case 'VENCE_HOJE':
      return 'vence hoje'
    case 'SALDO_INSUFICIENTE':
      return dias <= 0 ? 'a partir de hoje' : `a partir de ${dayMonth(p.data)} · ${relativo}`
    default:
      return dias === 0 ? 'hoje' : `${dayMonth(p.data)} · ${relativo}`
  }
}

export function soma(lista: Pendencia[], tipo: PendenciaTipo): { total: number; qtd: number } {
  const doTipo = lista.filter((p) => p.tipo === tipo)
  return { total: doTipo.reduce((acc, p) => acc + (p.valor ?? 0), 0), qtd: doTipo.length }
}
