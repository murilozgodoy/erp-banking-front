import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { AccountStatus } from '@/types/api'

const statuses: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Ativa', tone: 'success' },
  BLOCKED: { label: 'Bloqueada', tone: 'warning' },
  CLOSED: { label: 'Encerrada', tone: 'neutral' },
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const { label, tone } = statuses[status]
  return <Badge tone={tone}>{label}</Badge>
}
