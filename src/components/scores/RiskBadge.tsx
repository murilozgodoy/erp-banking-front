import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { FaixaRisco } from '@/types/api'

const ranges: Record<FaixaRisco, { label: string; tone: BadgeTone }> = {
  BAIXO: { label: 'Risco baixo', tone: 'success' },
  MEDIO: { label: 'Risco médio', tone: 'warning' },
  ALTO: { label: 'Risco alto', tone: 'danger' },
  MUITO_ALTO: { label: 'Risco muito alto', tone: 'danger' },
}

export function RiskBadge({ range }: { range: FaixaRisco }) {
  const { label, tone } = ranges[range]
  return <Badge tone={tone}>{label}</Badge>
}
