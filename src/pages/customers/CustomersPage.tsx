import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Table } from '@/components/ui/Table'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCpf, formatCurrency, formatDate } from '@/lib/format'

export function CustomersPage() {
  return (
    <RequirePermission permission="read:customers">
      <CustomersList />
    </RequirePermission>
  )
}

function CustomersList() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [term, setTerm] = useState(q)
  const customers = useQuery({
    queryKey: ['customers', { q }],
    queryFn: () => api.customers.list({ q: q || undefined }),
  })

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchParams(term.trim() ? { q: term.trim() } : {})
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Clientes cadastrados no Onboarding"
        actions={
          <Can permission="write:customers">
            <ButtonLink to="/clientes/novo">Novo cliente</ButtonLink>
          </Can>
        }
      />

      <form role="search" onSubmit={search} className="flex items-end gap-2">
        <InputField
          label="Buscar por nome ou CPF"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {customers.isPending ? (
        <Spinner label="Carregando clientes…" />
      ) : customers.isError ? (
        <Alert tone="error">{errorMessage(customers.error)}</Alert>
      ) : customers.data.length === 0 ? (
        <EmptyState>
          {q ? `Nenhum cliente encontrado para "${q}".` : 'Nenhum cliente cadastrado ainda.'}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table headers={['Cliente', 'CPF', 'E-mail', 'Renda mensal', 'Cadastro']}>
            {customers.data.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link
                    to={`/clientes/${customer.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {customer.nome}
                  </Link>
                </td>
                <td className="font-mono text-xs">{formatCpf(customer.cpf)}</td>
                <td>{customer.email}</td>
                <td>
                  {customer.financial_profile
                    ? formatCurrency(customer.financial_profile.renda_mensal)
                    : '—'}
                </td>
                <td>{formatDate(customer.created_at)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </section>
  )
}
