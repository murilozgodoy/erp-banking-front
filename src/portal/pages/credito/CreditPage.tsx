import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Clock, FileText, MessageSquareText, ShieldOff } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Faisca, Marca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { useAnalysis } from '../../layout/queries'
import { dayMonth, money, pct } from '../../lib/format'
import type { CreditOffer, PortalCreditRequest, ProdutoCredito, Simulation } from '../../types'
import { Button, ButtonLink } from '../../ui/Button'
import { PRODUTO_LABEL } from '../../ui/credit'
import { DataTable, type Column } from '../../ui/DataTable'
import { MoneyField } from '../../ui/Field'
import { GatedButton } from '../../ui/Gated'
import { InsightBlock } from '../../ui/InsightBlock'
import { Money } from '../../ui/Money'
import { OnboardingPendingState } from '../../ui/OnboardingPending'
import { Segmented } from '../../ui/Segmented'
import { EmptyState, ErrorState, Panel, PageHeader, Skeleton } from '../../ui/Surface'

import { ConfirmRequestSheet } from './ConfirmRequestSheet'
import { ContractSheet } from './ContractSheet'
import { RequestStatusPill } from './ContractOutcome'
import {
  contractLabel,
  creditErrorMessage,
  isOnboardingPendente,
  isProduto,
  prazosValidos,
  SIMULATION_ROOT,
  taxaFracao,
  useCreditAccess,
  useCreditRequests,
  useOffers,
  useSimulation,
} from './credit'
import { SimulationResult } from './SimulationResult'

/** Valor inicial: metade do limite, arredondada a R$ 1 mil. */
function valorPadrao(offer: CreditOffer): number {
  return Math.max(1000, Math.min(offer.limite, Math.round(offer.limite / 2 / 1000) * 1000))
}

function prazoPadrao(offer: CreditOffer): number {
  const prazos = prazosValidos(offer.prazo_max_meses)
  return prazos.includes(12) ? 12 : prazos[prazos.length - 1]
}

/** Produto inicial: o do link, senão o primeiro que não depende de escolher recebíveis. */
function ofertaInicial(offers: CreditOffer[], produto: string | null): CreditOffer {
  return (
    (isProduto(produto) && offers.find((o) => o.produto === produto)) ||
    offers.find((o) => o.produto !== 'ANTECIPACAO_RECEBIVEIS') ||
    offers[0]
  )
}

// ---------- Seus limites ----------

function Limits({
  offers,
  value,
  onChange,
}: {
  offers: CreditOffer[]
  value: ProdutoCredito
  onChange: (offer: CreditOffer) => void
}) {
  return (
    <Panel
      id="limites"
      title="Seus limites"
      description="Pré-aprovados pela leitura da sua operação. Escolha um para simular."
      flush
      // O painel acompanha a altura do simulador; o resumo fica preso ao rodapé.
      className="flex flex-col [&>:last-child]:flex [&>:last-child]:flex-1 [&>:last-child]:flex-col"
    >
      <div role="radiogroup" aria-labelledby="limites-title" className="border-t border-line">
        {offers.map((offer) => {
          const active = offer.produto === value
          return (
            <button
              key={offer.produto}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(offer)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-line px-5 py-3 text-left transition-colors duration-150',
                active ? 'bg-accent-soft/60' : 'hover:bg-paper',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border',
                  active ? 'border-accent' : 'border-line-strong',
                )}
              >
                {active && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {PRODUTO_LABEL[offer.produto]}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 self-center">
                    <Faisca label="Pré-aprovado pela ErpIa" />
                    <span className="tabular text-sm font-semibold text-ink">
                      {money(offer.limite)}
                    </span>
                  </span>
                </span>
                <span className="tabular block text-xs text-ink-muted">
                  a partir de {pct(offer.taxa_mensal_a_partir, 2)} a.m. · até{' '}
                  {offer.prazo_max_meses} meses
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <LimitsSummary offers={offers} />
    </Panel>
  )
}

/** Rodapé de "Seus limites": total pré-aprovado, quanto já foi contratado e de onde vem o limite. */
function LimitsSummary({ offers }: { offers: CreditOffer[] }) {
  const requests = useCreditRequests()
  const total = offers.reduce((sum, o) => sum + o.limite, 0)
  const contratado = (requests.data ?? [])
    .filter((r) => r.status === 'APROVADO')
    .reduce((sum, r) => sum + (r.valorAprovado ?? 0), 0)
  const usado = Math.min(contratado, total)
  const disponivel = Math.max(0, total - contratado)
  const fatia = total > 0 ? (usado / total) * 100 : 0

  return (
    <div className="mt-auto flex flex-col gap-5 px-5 pt-6 pb-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-ink-muted">Limite total pré-aprovado</p>
          <span className="flex items-center gap-1">
            <Faisca label="Pré-aprovado pela ErpIa" />
            <Money value={total} size="lg" className="text-ink" />
          </span>
        </div>
        {requests.isPending ? (
          <div role="status" aria-label="Carregando uso do limite" className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : requests.isError ? (
          <p className="text-xs text-ink-muted">
            Não conseguimos ver o que já foi contratado. Veja em Propostas e contratos.
          </p>
        ) : (
          <>
            <div
              role="meter"
              aria-label="Uso do limite pré-aprovado"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={usado}
              aria-valuetext={`${money(contratado)} contratados de ${money(total)}; ${money(disponivel)} disponíveis`}
              className="h-2 w-full overflow-hidden rounded-full bg-sunken"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${fatia}%` }} />
            </div>
            <dl className="tabular grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="flex items-center gap-1.5 text-ink-muted">
                  <span aria-hidden className="size-2 rounded-full bg-accent" />
                  Já contratado
                </dt>
                <dd className="mt-0.5 font-semibold text-ink">{money(contratado)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-ink-muted">
                  <span
                    aria-hidden
                    className="size-2 rounded-full border border-line-strong bg-sunken"
                  />
                  Disponível
                </dt>
                <dd className="mt-0.5 font-semibold text-ink">{money(disponivel)}</dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Faisca label={null} />
          <span>
            Como a <Marca /> calcula seus limites
          </span>
        </h3>
        <p className="text-xs text-ink-muted">
          Lemos sua receita, os recebíveis a entrar e o estoque, e cruzamos com o seu score. Quando
          a operação cresce, os limites acompanham na próxima leitura.
        </p>
        {/* Por enquanto leva ao início; a Sessão B liga este link ao assistente da ErpIa. */}
        <ButtonLink
          to="/app"
          size="sm"
          icon={<MessageSquareText aria-hidden className="size-4" />}
          className="h-auto min-h-8 self-start py-1.5 whitespace-normal"
        >
          <span>
            Perguntar à <Marca /> sobre meus limites
          </span>
        </ButtonLink>
      </div>
    </div>
  )
}

// ---------- Simulador ----------

function Simulator({
  offer,
  initialValor,
  onContract,
}: {
  offer: CreditOffer
  initialValor: number | null
  onContract: (simulation: Simulation) => void
}) {
  const [valor, setValor] = useState<number | null>(initialValor ?? valorPadrao(offer))
  const [prazo, setPrazo] = useState(prazoPadrao(offer))
  const prazos = prazosValidos(offer.prazo_max_meses)
  const antecipacao = offer.produto === 'ANTECIPACAO_RECEBIVEIS'
  const valido = valor !== null && valor > 0
  // Simular exige `pedir_credito` (seção 11): sem ela, nem chama a API.
  const { pede, contrata } = useCreditAccess()
  const sim = useSimulation(
    valido && !antecipacao && pede ? { produto: offer.produto, valor, prazo_meses: prazo } : null,
  )
  const simulation = sim.data
  const minimo = Math.min(1000, offer.limite)
  const acima = valido && valor > offer.limite

  return (
    <Panel
      id="simulador"
      title={`Simular ${PRODUTO_LABEL[offer.produto].toLowerCase()}`}
      description={
        <span className="tabular">
          Limite pré-aprovado de {money(offer.limite)}, a partir de{' '}
          {pct(offer.taxa_mensal_a_partir, 2)} a.m.
        </span>
      }
    >
      {antecipacao ? (
        <div className="flex flex-col items-start gap-3 border-t border-line pt-5">
          <p className="max-w-[60ch] text-sm text-ink-muted">
            A antecipação usa recebíveis específicos das suas maquininhas e boletos. Escolha na
            agenda quais quer antecipar: o simulador abre com até 80% do valor líquido deles.
          </p>
          <ButtonLink to="/app/recebiveis" variant="primary">
            Escolher recebíveis
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-6 border-t border-line pt-5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <MoneyField
                label="Valor"
                value={valor}
                onValueChange={setValor}
                error={
                  valor !== null && valor <= 0 ? 'Informe um valor maior que zero.' : undefined
                }
                hint={
                  acima
                    ? 'Acima do limite pré-aprovado: a proposta passa por análise.'
                    : `Até ${money(offer.limite)} pré-aprovado.`
                }
              />
              <input
                type="range"
                aria-label="Ajustar valor"
                min={minimo}
                max={offer.limite}
                step={100}
                value={Math.min(offer.limite, Math.max(minimo, valor ?? minimo))}
                onChange={(event) => setValor(Number(event.currentTarget.value))}
                className="h-2 w-full cursor-pointer accent-[var(--erpia-accent)]"
              />
              <div className="tabular flex justify-between text-xs text-ink-faint" aria-hidden>
                <span>{money(minimo)}</span>
                <span>{money(offer.limite)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p aria-hidden className="text-sm font-medium text-ink">
                Prazo em meses
              </p>
              <Segmented
                label="Prazo em meses"
                value={String(prazo)}
                options={prazos.map((p) => ({ value: String(p), label: `${p}x` }))}
                onChange={(v) => setPrazo(Number(v))}
                className="self-start"
              />
            </div>
          </div>
          <div className="min-w-0">
            {!pede ? (
              <div className="flex flex-col items-start gap-3">
                <p className="max-w-[48ch] text-sm text-ink-muted">
                  Você vê os limites da empresa, mas simular e contratar crédito pede a permissão de
                  pedir crédito.
                </p>
                <GatedButton permissao="pedir_credito" size="lg">
                  Simular
                </GatedButton>
              </div>
            ) : !valido ? (
              <p className="text-sm text-ink-muted">Informe um valor para ver as condições.</p>
            ) : sim.isError ? (
              <ErrorState
                title="Não conseguimos simular"
                message={creditErrorMessage(sim.error)}
                onRetry={() => void sim.refetch()}
              />
            ) : simulation ? (
              <>
                <SimulationResult simulation={simulation} pending={sim.pending} />
                <div className="mt-4">
                  <Button
                    size="lg"
                    disabled={sim.pending || simulation.aprovacao === 'NEGADO'}
                    onClick={() => onContract(simulation)}
                  >
                    {contractLabel(simulation.aprovacao, contrata)}
                  </Button>
                  {!contrata && simulation.aprovacao !== 'ANALISE' && (
                    <p className="mt-2 max-w-[52ch] text-xs text-ink-muted">
                      Quem tem a permissão de contratar crédito confirma a proposta; nada é
                      creditado até lá.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div role="status" aria-label="Simulando…" className="space-y-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

// ---------- Propostas e contratos ----------

const requestColumns: Column<PortalCreditRequest>[] = [
  {
    key: 'data',
    header: 'Data',
    cell: (r) => dayMonth(r.criadoEm),
    sort: (r) => r.criadoEm,
  },
  {
    key: 'valor',
    header: 'Valor solicitado',
    align: 'right',
    cell: (r) => money(r.valorSolicitado),
    sort: (r) => r.valorSolicitado,
  },
  {
    key: 'prazo',
    header: 'Prazo',
    align: 'right',
    hideBelow: 'sm',
    cell: (r) => (r.prazoMeses === 1 ? '1 mês' : `${r.prazoMeses} meses`),
  },
  {
    key: 'taxa',
    header: 'Taxa',
    align: 'right',
    hideBelow: 'sm',
    cell: (r) => taxaFracao(r.taxaJuros),
  },
  { key: 'status', header: 'Status', cell: (r) => <RequestStatusPill status={r.status} /> },
  {
    key: 'autor',
    header: 'Feito por',
    hideBelow: 'md',
    className: 'text-ink-faint',
    cell: (r) => (r.createdByNome ? `feito por ${r.createdByNome}` : '—'),
  },
  {
    key: 'motivo',
    header: 'Motivo',
    hideBelow: 'md',
    className: 'text-ink-muted',
    cell: (r) => r.motivo ?? '—',
  },
]

function Requests() {
  const requests = useCreditRequests()
  const { contrata } = useCreditAccess()
  const [confirmando, setConfirmando] = useState<PortalCreditRequest | null>(null)
  const closeConfirm = useCallback(() => setConfirmando(null), [])
  const aguardando = requests.data?.filter((r) => r.status === 'AGUARDANDO_CONTRATACAO') ?? []
  const columns: Column<PortalCreditRequest>[] =
    aguardando.length === 0
      ? requestColumns
      : [
          ...requestColumns,
          {
            key: 'acao',
            header: 'Ação',
            align: 'right',
            cell: (r) =>
              r.status === 'AGUARDANDO_CONTRATACAO' ? (
                <GatedButton
                  permissao="contratar_credito"
                  size="sm"
                  onClick={() => setConfirmando(r)}
                  aria-label={`Contratar a proposta nº ${r.id}`}
                >
                  Contratar
                </GatedButton>
              ) : null,
          },
        ]
  return (
    <>
      <Panel
        id="propostas"
        title="Propostas e contratos"
        description="Tudo o que você contratou ou enviou para análise."
        flush
      >
        {requests.isPending ? (
          <div role="status" aria-label="Carregando propostas" className="space-y-3 px-5 pb-5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : requests.isError ? (
          <div className="px-5 pb-5">
            <ErrorState
              message={creditErrorMessage(requests.error)}
              onRetry={() => void requests.refetch()}
            />
          </div>
        ) : (
          <div className="border-t border-line">
            {aguardando.length > 0 && (
              <p
                role="note"
                className="flex gap-2 border-b border-line bg-info-soft px-5 py-3 text-sm text-ink"
              >
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
                <span>
                  {aguardando.length === 1
                    ? '1 proposta aguarda contratação.'
                    : `${aguardando.length} propostas aguardam contratação.`}{' '}
                  {contrata
                    ? 'Revise e contrate na linha da proposta.'
                    : 'Quem tem a permissão de contratar crédito confirma; nada foi creditado ainda.'}
                </span>
              </p>
            )}
            <DataTable
              caption="Propostas e contratos de crédito"
              columns={columns}
              rows={requests.data}
              rowKey={(r) => r.id}
              initialSort={{ key: 'data', direction: 'desc' }}
              empty={
                <EmptyState
                  icon={<FileText aria-hidden className="size-5" />}
                  title="Nenhuma proposta ainda"
                >
                  Quando você contratar pelo simulador, a proposta e o status aparecem aqui.
                </EmptyState>
              }
            />
          </div>
        )}
      </Panel>
      <ConfirmRequestSheet request={confirmando} onClose={closeConfirm} />
    </>
  )
}

// ---------- Página ----------

function CreditSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando crédito"
      className="grid gap-4 lg:grid-cols-[22rem_1fr]"
    >
      <div className="space-y-4 rounded-panel border border-line bg-surface p-5 shadow-raised">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="space-y-4 rounded-panel border border-line bg-surface p-5 shadow-raised">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  )
}

/** Crédito: limites pré-aprovados, simulador com contratação e o histórico de propostas. */
export function CreditPage() {
  const [params] = useSearchParams()
  const offers = useOffers()
  const analysis = useAnalysis()
  const insight = analysis.data?.insights.find((i) => i.area === 'credito')
  const [selected, setSelected] = useState<ProdutoCredito | null>(null)
  const [contracting, setContracting] = useState<Simulation | null>(null)
  const queryClient = useQueryClient()

  const produtoParam = params.get('produto')
  const valorParam = Number(params.get('valor'))
  // Link novo (outra aba ou o insight) recomeça o simulador com o produto e o valor dele.
  const [lastParams, setLastParams] = useState(params.toString())
  if (params.toString() !== lastParams) {
    setLastParams(params.toString())
    setSelected(null)
  }

  let body
  if (offers.isPending) body = <CreditSkeleton />
  else if (offers.isError) {
    body = isOnboardingPendente(offers.error) ? (
      <OnboardingPendingState area="O crédito" />
    ) : (
      <ErrorState
        message={creditErrorMessage(offers.error)}
        onRetry={() => void offers.refetch()}
      />
    )
  } else if (offers.data.length === 0) {
    body = (
      <Panel>
        <EmptyState
          icon={<ShieldOff aria-hidden className="size-5" />}
          title="Sem limite pré-aprovado agora"
        >
          Com a leitura atual da sua operação, não conseguimos oferecer crédito com segurança para
          você. A análise é refeita todo mês: vendas registradas no ERP e contas pagas em dia são o
          que mais pesa.
        </EmptyState>
      </Panel>
    )
  } else {
    const offer = selected
      ? (offers.data.find((o) => o.produto === selected) ?? offers.data[0])
      : ofertaInicial(offers.data, produtoParam)
    const fromLink = !selected && offer.produto === produtoParam && valorParam > 0
    body = (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-stretch">
        <Limits
          offers={offers.data}
          value={offer.produto}
          onChange={(o) => setSelected(o.produto)}
        />
        <Simulator
          key={`${offer.produto}-${lastParams}`}
          offer={offer}
          initialValor={fromLink ? valorParam : null}
          onContract={setContracting}
        />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Crédito" description="Simule, contrate e acompanhe seu crédito." />
      <div className="flex flex-col gap-4">
        {insight && <InsightBlock insight={insight} />}
        {body}
        {!(offers.isError && isOnboardingPendente(offers.error)) && <Requests />}
      </div>
      <ContractSheet
        simulation={contracting}
        onClose={() => setContracting(null)}
        onResimulate={() => void queryClient.invalidateQueries({ queryKey: SIMULATION_ROOT })}
      />
    </>
  )
}
