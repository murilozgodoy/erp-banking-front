import type { Decisao } from '@/types/api'

import { Badge, type BadgeTone } from './ui/Badge'

const decisions: Record<Decisao, { label: string; tone: BadgeTone }> = {
  APROVADO: { label: 'Aprovado', tone: 'success' },
  REVISAO: { label: 'Em revisão', tone: 'warning' },
  NEGADO: { label: 'Negado', tone: 'danger' },
}

/** Decisão de crédito (sugerida pelo score ou tomada pela Transactions API). */
export function DecisionBadge({ decision }: { decision: Decisao }) {
  const { label, tone } = decisions[decision]
  return <Badge tone={tone}>{label}</Badge>
}
