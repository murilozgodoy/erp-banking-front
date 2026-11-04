import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { CreditRequestForm } from '@/components/credits/CreditRequestForm'
import { CreditsTable } from '@/components/credits/CreditsTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { ErrorState, PanelSkeleton } from '@/portal/ui/Surface'

export function CreditsPage() {
  return (
    <RequirePermission permission="read:credits">
      <CreditsList />
    </RequirePermission>
  )
}

function CreditsList() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerParam = searchParams.get('cliente') ?? ''
  const customerId = Number(customerParam) || undefined
  const [filter, setFilter] = useState(customerParam)
  const credits = useQuery({
    queryKey: ['credits', { customerId }],
    queryFn: () => api.credits.list(customerId),
  })

  const applyFilter = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchParams(filter ? { cliente: filter } : {})
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Crédito"
        description="Risco baixo é aprovado automaticamente (2,99% a.m.), risco médio vai para revisão manual e os demais são negados."
      />

      <Can permission="write:credits">
        <Card title="Solicitar crédito">
          <CreditRequestForm />
        </Card>
      </Can>

      <form role="search" onSubmit={applyFilter} className="flex items-end gap-2">
        <InputField
          label="Filtrar por ID do cliente"
          type="number"
          min={1}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-56"
        />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {credits.isPending ? (
        <PanelSkeleton label="Carregando pedidos…" />
      ) : credits.isError ? (
        <ErrorState
          title="Não conseguimos carregar os pedidos de crédito"
          message={errorMessage(credits.error)}
          onRetry={() => void credits.refetch()}
        />
      ) : credits.data.length === 0 ? (
        <EmptyState>
          {customerId
            ? `Nenhum pedido de crédito para o cliente #${customerId}.`
            : 'Nenhum pedido de crédito.'}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-sm">
          <CreditsTable credits={credits.data} />
        </div>
      )}
    </section>
  )
}
