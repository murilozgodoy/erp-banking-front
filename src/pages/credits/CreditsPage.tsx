import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { CreditRequestForm } from '@/components/credits/CreditRequestForm'
import { CreditsTable } from '@/components/credits/CreditsTable'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'

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
        <Spinner label="Carregando pedidos…" />
      ) : credits.isError ? (
        <Alert tone="error">{errorMessage(credits.error)}</Alert>
      ) : credits.data.length === 0 ? (
        <EmptyState>
          {customerId
            ? `Nenhum pedido de crédito para o cliente #${customerId}.`
            : 'Nenhum pedido de crédito.'}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CreditsTable credits={credits.data} />
        </div>
      )}
    </section>
  )
}
