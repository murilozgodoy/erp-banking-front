import { useQuery } from '@tanstack/react-query'

import { Can } from '@/components/auth/Can'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'

import { AccountsTable } from './AccountsTable'
import { OpenAccountForm } from './OpenAccountForm'

/** Contas do cliente na Transactions API, exibidas na ficha do cliente. */
export function CustomerAccounts({ customerId }: { customerId: number }) {
  const api = useApi()
  const accounts = useQuery({
    queryKey: ['accounts', { customerId }],
    queryFn: () => api.accounts.list(customerId),
  })

  return (
    <Card title="Contas" description="Contas correntes na Transactions API">
      <div className="space-y-4">
        {accounts.isPending ? (
          <Spinner label="Carregando contas…" />
        ) : accounts.isError ? (
          <Alert tone="error">{errorMessage(accounts.error)}</Alert>
        ) : accounts.data.length === 0 ? (
          <EmptyState>Nenhuma conta aberta para este cliente.</EmptyState>
        ) : (
          <AccountsTable accounts={accounts.data} />
        )}
        <Can permission="write:accounts">
          <div className="border-t border-slate-100 pt-4">
            <OpenAccountForm customerId={customerId} />
          </div>
        </Can>
      </div>
    </Card>
  )
}
