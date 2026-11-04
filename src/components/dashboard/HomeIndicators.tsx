import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useApi } from '@/hooks/useApi'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatNumber } from '@/lib/format'
import { Skeleton } from '@/portal/ui/Surface'
import type { CreditStatus } from '@/types/api'

/** Máximo aceito pelo `GET /customers` da Onboarding API (sem total na resposta). */
export const CUSTOMERS_PAGE_LIMIT = 200

const statusStyles: Record<CreditStatus, { label: string; bar: string }> = {
  APROVADO: { label: 'Aprovados', bar: 'bg-positive' },
  REVISAO: { label: 'Em revisão', bar: 'bg-warning' },
  NEGADO: { label: 'Negados', bar: 'bg-negative' },
}

/** Indicadores da home, cada um exibido só para quem tem a permissão de leitura. */
export function HomeIndicators() {
  const { can } = usePermissions()
  if (!can('read:customers') && !can('read:accounts') && !can('read:credits')) return null

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-ink">Indicadores</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {can('read:customers') && <CustomersIndicator />}
        {can('read:accounts') && <AccountsIndicator />}
        {can('read:credits') && <CreditsIndicator />}
      </div>
    </div>
  )
}

interface IndicatorProps {
  title: string
  query: { isPending: boolean; isError: boolean; error: unknown }
  children: () => ReactNode
}

function Indicator({ title, query, children }: IndicatorProps) {
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-sm text-ink-muted">{title}</p>
      {query.isPending ? (
        <div
          role="status"
          aria-label={`Carregando ${title.toLowerCase()}…`}
          className="mt-2 space-y-2"
        >
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="mt-2 text-sm text-negative">
          {errorMessage(query.error)}
        </p>
      ) : (
        children()
      )}
    </section>
  )
}

function CustomersIndicator() {
  const api = useApi()
  const customers = useQuery({
    queryKey: ['customers', 'indicator'],
    queryFn: () => api.customers.list({ limit: CUSTOMERS_PAGE_LIMIT }),
  })
  return (
    <Indicator title="Clientes cadastrados" query={customers}>
      {() => {
        const total = customers.data?.length ?? 0
        const withAnamnesis = customers.data?.filter((c) => c.anamnesis).length ?? 0
        return (
          <>
            <p className="tabular mt-1 text-3xl font-bold text-ink">
              {formatNumber(total)}
              {total >= CUSTOMERS_PAGE_LIMIT ? '+' : ''}
            </p>
            <p className="tabular text-xs text-ink-muted">
              {formatNumber(withAnamnesis)} com anamnese
            </p>
          </>
        )
      }}
    </Indicator>
  )
}

function AccountsIndicator() {
  const api = useApi()
  const accounts = useQuery({ queryKey: ['accounts', {}], queryFn: () => api.accounts.list() })
  return (
    <Indicator title="Contas" query={accounts}>
      {() => {
        const list = accounts.data ?? []
        const active = list.filter((account) => account.status === 'ACTIVE').length
        const balance = list.reduce((sum, account) => sum + account.saldo, 0)
        return (
          <>
            <p className="tabular mt-1 text-3xl font-bold text-ink">{formatNumber(list.length)}</p>
            <p className="tabular text-xs text-ink-muted">
              {formatNumber(active)} ativas · saldo total {formatCurrency(balance)}
            </p>
          </>
        )
      }}
    </Indicator>
  )
}

function CreditsIndicator() {
  const api = useApi()
  const credits = useQuery({ queryKey: ['credits', {}], queryFn: () => api.credits.list() })
  return (
    <Indicator title="Pedidos de crédito" query={credits}>
      {() => {
        const list = credits.data ?? []
        const approvedValue = list.reduce((sum, credit) => sum + credit.valorAprovado, 0)
        const counts = (Object.keys(statusStyles) as CreditStatus[]).map((status) => ({
          status,
          count: list.filter((credit) => credit.status === status).length,
        }))
        return (
          <>
            <p className="tabular mt-1 text-3xl font-bold text-ink">{formatNumber(list.length)}</p>
            <p className="tabular text-xs text-ink-muted">
              {formatCurrency(approvedValue)} aprovados
            </p>
            {list.length > 0 && (
              <div
                className="mt-3 flex h-2 overflow-hidden rounded-full bg-sunken"
                aria-hidden="true"
              >
                {counts.map(({ status, count }) => (
                  <div
                    key={status}
                    className={statusStyles[status].bar}
                    style={{ width: `${(count / list.length) * 100}%` }}
                  />
                ))}
              </div>
            )}
            <ul className="tabular mt-2 space-y-0.5 text-xs text-ink-muted">
              {counts.map(({ status, count }) => (
                <li key={status} className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${statusStyles[status].bar}`} />
                  {statusStyles[status].label}: {formatNumber(count)}
                </li>
              ))}
            </ul>
          </>
        )
      }}
    </Indicator>
  )
}
