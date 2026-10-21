import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { AccountsTable } from '@/components/accounts/AccountsTable'
import { OpenAccountForm } from '@/components/accounts/OpenAccountForm'
import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'

export function AccountsPage() {
  return (
    <RequirePermission permission="read:accounts">
      <AccountsList />
    </RequirePermission>
  )
}

function AccountsList() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerParam = searchParams.get('cliente') ?? ''
  const customerId = Number(customerParam) || undefined
  const [filter, setFilter] = useState(customerParam)
  const accounts = useQuery({
    queryKey: ['accounts', { customerId }],
    queryFn: () => api.accounts.list(customerId),
  })

  const applyFilter = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchParams(filter ? { cliente: filter } : {})
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Contas" description="Contas correntes e extratos da Transactions API" />

      <Can permission="write:accounts">
        <Card title="Abrir conta">
          <OpenAccountForm />
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

      {accounts.isPending ? (
        <Spinner label="Carregando contas…" />
      ) : accounts.isError ? (
        <Alert tone="error">{errorMessage(accounts.error)}</Alert>
      ) : accounts.data.length === 0 ? (
        <EmptyState>
          {customerId ? `Nenhuma conta para o cliente #${customerId}.` : 'Nenhuma conta aberta.'}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <AccountsTable accounts={accounts.data} />
        </div>
      )}
    </section>
  )
}
