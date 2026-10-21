import { Link } from 'react-router'

import { Table } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/format'
import type { Account } from '@/types/api'

import { AccountStatusBadge } from './AccountStatusBadge'

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  return (
    <Table headers={['Conta', 'Cliente', 'Saldo', 'Status']}>
      {accounts.map((account) => (
        <tr key={account.id}>
          <td>
            <Link
              to={`/contas/${account.id}`}
              className="font-medium text-indigo-700 hover:underline"
            >
              Conta #{account.id}
            </Link>
          </td>
          <td>
            <Link to={`/clientes/${account.customerId}`} className="hover:underline">
              Cliente #{account.customerId}
            </Link>
          </td>
          <td className="font-medium">{formatCurrency(account.saldo)}</td>
          <td>
            <AccountStatusBadge status={account.status} />
          </td>
        </tr>
      ))}
    </Table>
  )
}
