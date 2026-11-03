import { useQuery } from '@tanstack/react-query'

import { Can } from '@/components/auth/Can'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { ErrorState, PanelSkeleton } from '@/portal/ui/Surface'

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
          <PanelSkeleton label="Carregando pedidos…" />
        ) : credits.isError ? (
          <ErrorState
            title="Não conseguimos carregar os pedidos de crédito"
            message={errorMessage(credits.error)}
            onRetry={() => void credits.refetch()}
          />
        ) : credits.data.length === 0 ? (
          <EmptyState>Nenhum pedido de crédito para este cliente.</EmptyState>
        ) : (
          <CreditsTable credits={credits.data} />
        )}
      </div>
    </Card>
  )
}
