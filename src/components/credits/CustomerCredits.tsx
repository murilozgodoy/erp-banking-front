import { useQuery } from '@tanstack/react-query'

import { Can } from '@/components/auth/Can'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'

import { CreditRequestForm } from './CreditRequestForm'
import { CreditsTable } from './CreditsTable'

/** Pedidos de crédito do cliente, exibidos na ficha do cliente. */
export function CustomerCredits({ customerId }: { customerId: number }) {
  const api = useApi()
  const credits = useQuery({
    queryKey: ['credits', { customerId }],
    queryFn: () => api.credits.list(customerId),
  })

  return (
    <Card title="Crédito" description="Pedidos decididos a partir do score vigente">
      <div className="space-y-4">
        <Can permission="write:credits">
          <CreditRequestForm customerId={customerId} />
        </Can>
        {credits.isPending ? (
          <Spinner label="Carregando pedidos…" />
        ) : credits.isError ? (
          <Alert tone="error">{errorMessage(credits.error)}</Alert>
        ) : credits.data.length === 0 ? (
          <EmptyState>Nenhum pedido de crédito para este cliente.</EmptyState>
        ) : (
          <CreditsTable credits={credits.data} />
        )}
      </div>
    </Card>
  )
}
