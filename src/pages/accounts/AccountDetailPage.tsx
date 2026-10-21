import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { AccountStatusBadge } from '@/components/accounts/AccountStatusBadge'
import { Can } from '@/components/auth/Can'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField, SelectField } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Table } from '@/components/ui/Table'
import { useApi } from '@/hooks/useApi'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Account, TransactionInput, TransactionType } from '@/types/api'

export function AccountDetailPage() {
  return (
    <RequirePermission permission="read:accounts">
      <AccountDetail />
    </RequirePermission>
  )
}

function AccountDetail() {
  const api = useApi()
  const accountId = Number(useParams().id)
  const account = useQuery({
    queryKey: ['accounts', accountId],
    queryFn: () => api.accounts.get(accountId),
  })

  if (account.isPending) return <Spinner label="Carregando conta…" />
  if (account.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{errorMessage(account.error)}</Alert>
        <ButtonLink to="/contas" variant="secondary">
          Voltar para contas
        </ButtonLink>
      </div>
    )
  }

  const a = account.data
  return (
    <section className="space-y-6">
      <PageHeader
        title={`Conta #${a.id}`}
        description={
          <>
            Titular:{' '}
            <Link to={`/clientes/${a.customerId}`} className="text-indigo-700 hover:underline">
              cliente #{a.customerId}
            </Link>
          </>
        }
        actions={
          <ButtonLink to="/contas" variant="secondary">
            Voltar
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Saldo">
          <p className="text-3xl font-bold">{formatCurrency(a.saldo)}</p>
          <div className="mt-2">
            <AccountStatusBadge status={a.status} />
          </div>
        </Card>
        <Can permission="write:accounts">
          <div className="lg:col-span-2">
            <Card title="Nova transação">
              <TransactionForm account={a} />
            </Card>
          </div>
        </Can>
      </div>

      <Statement accountId={a.id} />
    </section>
  )
}

function TransactionForm({ account }: { account: Account }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<TransactionType>('CREDIT')
  const [valor, setValor] = useState('')

  const register = useMutation({
    mutationFn: (input: TransactionInput) => api.accounts.registerTransaction(input),
    onSuccess: () => {
      setValor('')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    register.mutate({ accountId: account.id, tipo, valor: Number(valor) })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Tipo"
          value={tipo}
          onChange={(event) => setTipo(event.target.value as TransactionType)}
          className="w-48"
        >
          <option value="CREDIT">Crédito (entrada)</option>
          <option value="DEBIT">Débito (saída)</option>
        </SelectField>
        <InputField
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          className="w-40"
        />
        <Button type="submit" loading={register.isPending} disabled={account.status !== 'ACTIVE'}>
          Registrar
        </Button>
      </div>
      {register.isError && <Alert tone="error">{errorMessage(register.error)}</Alert>}
      {register.isSuccess && (
        <Alert tone="success">
          Transação registrada. Saldo atual: {formatCurrency(register.data.saldoAtual)}.
        </Alert>
      )}
    </form>
  )
}

function Statement({ accountId }: { accountId: number }) {
  const api = useApi()
  const statement = useQuery({
    queryKey: ['accounts', accountId, 'statement'],
    queryFn: () => api.accounts.statement(accountId),
  })

  return (
    <Card title="Extrato" description="Lançamentos do mais recente para o mais antigo">
      {statement.isPending ? (
        <Spinner label="Carregando extrato…" />
      ) : statement.isError ? (
        <Alert tone="error">{errorMessage(statement.error)}</Alert>
      ) : statement.data.length === 0 ? (
        <EmptyState>Nenhuma transação registrada.</EmptyState>
      ) : (
        <Table headers={['Data', 'Tipo', 'Valor', 'Saldo após']}>
          {statement.data.map((transaction) => {
            const credit = transaction.tipo === 'CREDIT'
            return (
              <tr key={transaction.id}>
                <td>{formatDateTime(transaction.timestamp)}</td>
                <td>
                  <Badge tone={credit ? 'success' : 'danger'}>
                    {credit ? 'Crédito' : 'Débito'}
                  </Badge>
                </td>
                <td className={credit ? 'text-emerald-700' : 'text-red-700'}>
                  {credit ? '+' : '−'} {formatCurrency(transaction.valor)}
                </td>
                <td>{formatCurrency(transaction.saldoAtual)}</td>
              </tr>
            )
          })}
        </Table>
      )}
    </Card>
  )
}
