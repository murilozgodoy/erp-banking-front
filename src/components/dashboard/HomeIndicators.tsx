import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Spinner } from '@/components/ui/Spinner'
import { useApi } from '@/hooks/useApi'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { CreditStatus } from '@/types/api'

/** Máximo aceito pelo `GET /customers` da Onboarding API (sem total na resposta). */
export const CUSTOMERS_PAGE_LIMIT = 200

const statusStyles: Record<CreditStatus, { label: string; bar: string }> = {
  APROVADO: { label: 'Aprovados', bar: 'bg-emerald-500' },
  REVISAO: { label: 'Em revisão', bar: 'bg-amber-400' },
  NEGADO: { label: 'Negados', bar: 'bg-red-500' },
}

/** Indicadores da home, cada um exibido só para quem tem a permissão de leitura. */
export function HomeIndicators() {
  const { can } = usePermissions()
  if (!can('read:customers') && !can('read:accounts') && !can('read:credits')) return null

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-slate-900">Indicadores</h2>
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
    <section
      aria-label={title}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm text-slate-500">{title}</p>
      {query.isPending ? (
        <Spinner label="Carregando…" />
      ) : query.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
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
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {formatNumber(total)}
              {total >= CUSTOMERS_PAGE_LIMIT ? '+' : ''}
            </p>
            <p className="text-xs text-slate-500">{formatNumber(withAnamnesis)} com anamnese</p>
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
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(list.length)}</p>
            <p className="text-xs text-slate-500">
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
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(list.length)}</p>
            <p className="text-xs text-slate-500">{formatCurrency(approvedValue)} aprovados</p>
            {list.length > 0 && (
              <div
                className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
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
            <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
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
