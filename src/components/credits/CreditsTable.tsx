import { Link } from 'react-router'

import { DecisionBadge } from '@/components/DecisionBadge'
import { Table } from '@/components/ui/Table'
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import type { CreditRequest } from '@/types/api'

export function CreditsTable({ credits }: { credits: CreditRequest[] }) {
  return (
    <Table
      headers={['Pedido', 'Cliente', 'Solicitado', 'Prazo', 'Score', 'Decisão', 'Taxa', 'Aprovado']}
    >
      {credits.map((credit) => (
        <tr key={credit.id}>
          <td>
            <p className="font-medium">#{credit.id}</p>
            <p className="text-xs text-slate-500">{formatDateTime(credit.criadoEm)}</p>
          </td>
          <td>
            <Link to={`/clientes/${credit.customerId}`} className="hover:underline">
              Cliente #{credit.customerId}
            </Link>
          </td>
          <td>{formatCurrency(credit.valorSolicitado)}</td>
          <td>{credit.prazoMeses} meses</td>
          <td>{credit.scoreSnapshot === null ? '—' : formatNumber(credit.scoreSnapshot, 0)}</td>
          <td>
            <DecisionBadge decision={credit.status} />
            {credit.motivo && <p className="mt-1 text-xs text-slate-500">{credit.motivo}</p>}
          </td>
          <td>{credit.taxaJuros > 0 ? `${formatPercent(credit.taxaJuros * 100)} a.m.` : '—'}</td>
          <td>{credit.valorAprovado > 0 ? formatCurrency(credit.valorAprovado) : '—'}</td>
        </tr>
      ))}
    </Table>
  )
}
