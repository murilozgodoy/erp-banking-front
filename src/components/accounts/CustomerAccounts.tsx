import { useQuery } from '@tanstack/react-query'

import { Can } from '@/components/auth/Can'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { ErrorState, PanelSkeleton } from '@/portal/ui/Surface'
import { pollWhileEmpty } from '@/lib/polling'

import { AccountsTable } from './AccountsTable'
import { OpenAccountForm } from './OpenAccountForm'

/** Contas do cliente na Transactions API, exibidas na ficha do cliente. */
export function CustomerAccounts({ customerId }: { customerId: number }) {
  const api = useApi()
  const accounts = useQuery({
    queryKey: ['accounts', { customerId }],
    queryFn: () => api.accounts.list(customerId),
    // Cliente recém-criado: a conta corrente é aberta pelo evento customer.created, logo depois.
    refetchInterval: pollWhileEmpty,
  })

  return (
    <Card title="Contas" description="Contas correntes na Transactions API">
      <div className="space-y-4">
        {accounts.isPending ? (
          <PanelSkeleton label="Carregando contas…" />
        ) : accounts.isError ? (
          <ErrorState
            title="Não conseguimos carregar as contas"
            message={errorMessage(accounts.error)}
            onRetry={() => void accounts.refetch()}
          />
        ) : accounts.data.length === 0 ? (
          <EmptyState>Nenhuma conta aberta para este cliente.</EmptyState>
        ) : (
          <AccountsTable accounts={accounts.data} />
        )}
        <Can permission="write:accounts">
          <div className="border-t border-line pt-4">
            <OpenAccountForm customerId={customerId} />
          </div>
        </Can>
      </div>
    </Card>
  )
}
