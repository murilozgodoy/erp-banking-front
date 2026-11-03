import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { useAnalysis, useOverview } from '../../layout/queries'
import { daysFromToday, money } from '../../lib/format'
import type { Payable } from '../../types'
import { GatedButton } from '../../ui/Gated'
import { InsightBlock, type InsightOffer } from '../../ui/InsightBlock'
import { Money } from '../../ui/Money'
import { StatStrip, type Stat } from '../../ui/StatStrip'
import { OnboardingPendingState } from '../../ui/OnboardingPending'
import { ErrorState, PageHeader } from '../../ui/Surface'
import { ApprovalTray } from './ApprovalTray'
import { HistoryPanel } from './HistoryPanel'
import { isOnboardingPendente, pagavel } from './model'
import { PayablesPanel } from './PayablesPanel'
import { PaymentSheet } from './PaymentSheet'
import { usePayables } from './queries'
import { StatementPanel } from './StatementPanel'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Pagamentos (banking): saldo, contas a pagar, pagar/agendar, extrato e histórico. */
export function PaymentsPage() {
  const overview = useOverview()
  const analysis = useAnalysis()
  const payables = usePayables()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sheet, setSheet] = useState<{ open: boolean; payable: Payable | null; key: number }>({
    open: false,
    payable: null,
    key: 0,
  })

  const openSheet = useCallback(
    (payable: Payable | null) => setSheet((s) => ({ open: true, payable, key: s.key + 1 })),
    [],
  )
  const closeSheet = useCallback(() => {
    setSheet((s) => ({ ...s, open: false }))
    setSearchParams(
      (params) => {
        params.delete('conta')
        return params
      },
      { replace: true },
    )
  }, [setSearchParams])

  // Link das pendências (`?conta=<id>`): abre o pagamento da conta assim que a lista chega.
  const contaParam = searchParams.get('conta')
  const [linked, setLinked] = useState<string | null>(null)
  if (contaParam && contaParam !== linked && payables.data) {
    setLinked(contaParam)
    const conta = payables.data.itens.find((c) => String(c.id) === contaParam && pagavel(c))
    if (conta) setSheet((s) => ({ open: true, payable: conta, key: s.key + 1 }))
  }

  const report = payables.data
  const saldo = overview.data?.saldo
  const conta = overview.data?.conta ?? null

  const semana = useMemo(
    () =>
      (report?.itens ?? []).filter(
        (c) =>
          c.status !== 'PAGO' &&
          c.status !== 'ATRASADO' &&
          daysFromToday(c.vencimento) >= 0 &&
          daysFromToday(c.vencimento) <= 7,
      ).length,
    [report],
  )
  const atrasadas = report?.itens.filter((c) => c.status === 'ATRASADO').length ?? 0
  const shortfall = report && saldo !== undefined ? Math.max(0, report.proximos_7d - saldo) : 0

  if ([overview.error, payables.error].some(isOnboardingPendente)) {
    return (
      <>
        <PageHeader
          title="Pagamentos"
          description="Saldo, contas a pagar, PIX, boletos e extrato da conta PJ."
        />
        <OnboardingPendingState area="A conta PJ, com pagamentos e extrato," />
      </>
    )
  }

  const stats: Stat[] = [
    {
      label: 'Saldo disponível',
      value: saldo !== undefined ? <Money value={saldo} size="lg" /> : '—',
      detail: conta ? (
        <span className="tabular">
          <span className="whitespace-nowrap">Ag. {conta.agencia}</span> ·{' '}
          <span className="whitespace-nowrap">CC {conta.numero}</span>
        </span>
      ) : (
        'Conta PJ em abertura'
      ),
    },
    {
      label: 'A pagar em 7 dias',
      value: report ? <Money value={report.proximos_7d} size="lg" /> : '—',
      detail:
        shortfall > 0 ? (
          <span className="font-medium text-negative">Faltam {money(shortfall)} no saldo</span>
        ) : (
          `${plural(semana, 'conta', 'contas')} · o saldo cobre`
        ),
    },
    {
      label: 'Atrasado',
      value: report ? (
        <Money
          value={report.total_atrasado}
          size="lg"
          className={cn(report.total_atrasado > 0 && 'text-negative')}
        />
      ) : (
        '—'
      ),
      detail:
        atrasadas > 0
          ? `${plural(atrasadas, 'conta', 'contas')} · juros correndo`
          : 'Nada atrasado',
    },
    {
      label: 'Total em aberto',
      value: report ? <Money value={report.total_aberto} size="lg" /> : '—',
      detail: 'A vencer, com as agendadas',
    },
  ]

  const insight = analysis.data?.insights.find((i) => i.area === 'pagamentos')
  const capital = analysis.data?.oportunidades.find((o) => o.tipo === 'CAPITAL_DE_GIRO')
  const offer: InsightOffer | undefined =
    shortfall > 0
      ? {
          produto: 'CAPITAL_DE_GIRO',
          valor: Math.ceil(shortfall),
          taxa_mensal: capital?.taxa_mensal,
          racional: 'cobre a diferença entre o saldo e as contas da semana',
          cta: 'Pagar com capital de giro',
        }
      : undefined

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Saldo, contas a pagar, PIX, boletos e extrato da conta PJ."
        actions={
          <GatedButton
            permissao="pagar"
            icon={<Plus className="size-4" />}
            onClick={() => openSheet(null)}
            disabled={overview.isSuccess && !conta}
            title={overview.isSuccess && !conta ? 'A conta PJ ainda está sendo aberta' : undefined}
          >
            Novo pagamento
          </GatedButton>
        }
      />

      <div className="space-y-4">
        <ApprovalTray />

        {overview.isError ? (
          <ErrorState
            title="Não conseguimos carregar o saldo"
            message={errorMessage(overview.error)}
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <StatStrip stats={stats} loading={overview.isPending || payables.isPending} />
        )}

        <InsightBlock insight={insight} offer={offer} />

        <PayablesPanel query={payables} onPay={(c) => openSheet(c)} onNew={() => openSheet(null)} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <StatementPanel />
          <HistoryPanel onNew={() => openSheet(null)} />
        </div>
      </div>

      <PaymentSheet
        key={sheet.key}
        open={sheet.open}
        onClose={closeSheet}
        payable={sheet.payable}
        saldo={saldo}
        conta={conta}
      />
    </>
  )
}
