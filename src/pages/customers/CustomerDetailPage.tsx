import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { CustomerAccounts } from '@/components/accounts/CustomerAccounts'
import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { AnamnesisCard } from '@/components/customers/AnamnesisCard'
import { ScorePanel } from '@/components/scores/ScorePanel'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCpf, formatCurrency, formatDate } from '@/lib/format'
import type { Customer } from '@/types/api'

export function CustomerDetailPage() {
  return (
    <RequirePermission permission="read:customers">
      <CustomerDetail />
    </RequirePermission>
  )
}

function CustomerDetail() {
  const api = useApi()
  const customerId = Number(useParams().id)
  const customer = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.customers.get(customerId),
  })

  if (customer.isPending) return <Spinner label="Carregando cliente…" />
  if (customer.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{errorMessage(customer.error)}</Alert>
        <ButtonLink to="/clientes" variant="secondary">
          Voltar para clientes
        </ButtonLink>
      </div>
    )
  }

  const c = customer.data
  return (
    <section className="space-y-6">
      <PageHeader
        title={c.nome}
        description={`Cliente #${c.id} · CPF ${formatCpf(c.cpf)} · desde ${formatDate(c.created_at)}`}
        actions={
          <ButtonLink to="/clientes" variant="secondary">
            Voltar
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RegistrationCard customer={c} />
        <AnamnesisCard customer={c} />
      </div>

      <Can permission="read:scores">
        <ScorePanel customerId={c.id} />
      </Can>

      <Can permission="read:accounts">
        <CustomerAccounts customerId={c.id} />
      </Can>
    </section>
  )
}

function RegistrationCard({ customer }: { customer: Customer }) {
  const { address, financial_profile: profile } = customer
  const rows: [string, string][] = [
    ['E-mail', customer.email],
    ['Telefone', customer.telefone],
    [
      'Endereço',
      address
        ? `${address.rua}, ${address.numero} · ${address.cidade}/${address.estado} · CEP ${address.cep}`
        : 'Não informado',
    ],
    ['Renda mensal', profile ? formatCurrency(profile.renda_mensal) : 'Não informada'],
    ['Patrimônio', profile ? formatCurrency(profile.patrimonio) : 'Não informado'],
    ['Ocupação', profile?.ocupacao || 'Não informada'],
  ]
  return (
    <Card title="Dados cadastrais">
      <dl className="grid gap-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="col-span-2 text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
