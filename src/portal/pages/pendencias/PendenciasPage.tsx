import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  HandCoins,
  PackageMinus,
  TrendingDown,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { portalKeys, useAnalysis } from '../../layout/queries'
import { isOnboardingPendente } from '../../lib/apiErrors'
import { money } from '../../lib/format'
import type { Pendencia, PendenciaTipo, Permissao } from '../../types'
import { ButtonLink } from '../../ui/Button'
import { GatedButtonLink } from '../../ui/Gated'
import { PRODUTO_LABEL, simulatorHref } from '../../ui/credit'
import { InsightBlock, type InsightOffer } from '../../ui/InsightBlock'
import { Money } from '../../ui/Money'
import { OnboardingPendingState } from '../../ui/OnboardingPending'
import { Pill, type Tone } from '../../ui/Pill'
import { Segmented } from '../../ui/Segmented'
import { StatStrip } from '../../ui/StatStrip'
import { EmptyState, ErrorState, PageHeader, Panel, PanelSkeleton } from '../../ui/Surface'

import { agrupar, grupoDe, quando, soma, type GrupoKey } from './pendencias'

const pendenciasKey = [...portalKeys.erp, 'pendencias'] as const

const TIPO: Record<
  PendenciaTipo,
  { label: string; tone: Tone; icon: ReactNode; circle: string; valor: string }
> = {
  CONTA_ATRASADA: {
    label: 'Atrasada',
    tone: 'negative',
    icon: <AlertTriangle className="size-4" />,
    circle: 'bg-negative-soft text-negative',
    valor: 'Valor da conta',
  },
  SALDO_INSUFICIENTE: {
    label: 'Caixa',
    tone: 'negative',
    icon: <TrendingDown className="size-4" />,
    circle: 'bg-negative-soft text-negative',
    valor: 'Falta no caixa',
  },
  VENCE_HOJE: {
    label: 'Vence hoje',
    tone: 'warning',
    icon: <CalendarClock className="size-4" />,
    circle: 'bg-warning-soft text-warning',
    valor: 'Valor da conta',
  },
  PROPOSTA_CREDITO: {
    label: 'Crédito',
    tone: 'info',
    icon: <HandCoins className="size-4" />,
    circle: 'bg-info-soft text-info',
    valor: 'Valor',
  },
  ESTOQUE_BAIXO: {
    label: 'Estoque baixo',
    tone: 'warning',
    icon: <PackageMinus className="size-4" />,
    circle: 'bg-warning-soft text-warning',
    valor: 'Custo de reposição',
  },
  ESTOQUE_PARADO: {
    label: 'Estoque parado',
    tone: 'neutral',
    icon: <Archive className="size-4" />,
    circle: 'bg-sunken text-ink-muted',
    valor: 'Capital parado',
  },
}

/** A ação herda a permissão do destino: pagar uma conta exige `pagar`; crédito, `pedir_credito`. */
function permissaoDaRota(rota: string): Permissao | null {
  if (rota.startsWith('/app/pagamentos')) return 'pagar'
  if (rota.startsWith('/app/credito')) return 'pedir_credito'
  return null
}

function ActionLink({
  rota,
  urgente,
  children,
}: {
  rota: string
  urgente: boolean
  children: ReactNode
}) {
  const variant = urgente ? 'primary' : 'secondary'
  const permissao = permissaoDaRota(rota)
  return permissao ? (
    <GatedButtonLink permissao={permissao} to={rota} variant={variant} size="sm">
      {children}
    </GatedButtonLink>
  ) : (
    <ButtonLink to={rota} variant={variant} size="sm">
      {children}
    </ButtonLink>
  )
}

function PendenciaRow({ pendencia, urgente }: { pendencia: Pendencia; urgente: boolean }) {
  const meta = TIPO[pendencia.tipo]
  const { acao } = pendencia
  const credito = acao.credito
  // Quando a própria ação é ir ao crédito, ela já é a sugestão: vai direto ao simulador.
  const acaoDeCredito = !!credito && acao.rota.startsWith('/app/credito')
  return (
    <li className="flex gap-3 px-5 py-4">
      <span
        aria-hidden
        className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', meta.circle)}
      >
        {meta.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{pendencia.titulo}</h3>
          <p className="mt-0.5 max-w-[68ch] text-sm text-ink-muted">{pendencia.descricao}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <time dateTime={pendencia.data}>{quando(pendencia)}</time>
          </p>
          {credito && !acaoDeCredito && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-credit-line bg-credit-soft px-3 py-2 text-sm text-credit-ink">
              <Faisca />
              <span>
                Resolva com {PRODUTO_LABEL[credito.produto].toLocaleLowerCase('pt-BR')}:{' '}
                <span className="tabular font-medium text-ink">até {money(credito.valor)}</span>
              </span>
              <Link
                to={simulatorHref(credito.produto, credito.valor)}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-ink"
              >
                Simular
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-2">
          {pendencia.valor !== null && (
            <p className="sm:text-right">
              <span className="block text-xs text-ink-muted">{meta.valor}</span>
              <Money value={pendencia.valor} size="md" />
            </p>
          )}
          {acaoDeCredito ? (
            <GatedButtonLink
              permissao="pedir_credito"
              to={simulatorHref(credito.produto, credito.valor)}
              variant="credit"
              size="sm"
            >
              {acao.label}
              <ArrowRight aria-hidden className="size-4" />
            </GatedButtonLink>
          ) : (
            <ActionLink rota={acao.rota} urgente={urgente}>
              {acao.label}
            </ActionLink>
          )}
        </div>
      </div>
    </li>
  )
}

type Filtro = 'todas' | GrupoKey

function Queue({ lista }: { lista: Pendencia[] }) {
  const reduce = useReducedMotion()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const grupos = agrupar(lista)
  const visiveis = grupos.filter(({ grupo, itens }) =>
    filtro === 'todas' ? itens.length > 0 : grupo.key === filtro,
  )
  return (
    <div className="space-y-4">
      <Segmented<Filtro>
        label="Filtrar pendências"
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todas', label: `Todas (${lista.length})` },
          ...grupos.map(({ grupo, itens }) => ({
            value: grupo.key,
            label: `${grupo.titulo} (${itens.length})`,
          })),
        ]}
      />
      <motion.div
        key={filtro}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        {visiveis.map(({ grupo, itens }) => (
          <Panel
            key={grupo.key}
            id={`pendencias-${grupo.key}`}
            title={grupo.titulo}
            description={grupo.descricao}
            flush
          >
            {itens.length > 0 ? (
              <ul className="divide-y divide-line border-t border-line">
                {itens.map((p) => (
                  <PendenciaRow key={p.id} pendencia={p} urgente={grupo.key === 'agora'} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Nada neste grupo">
                Quando surgir algo de {grupo.titulo.toLocaleLowerCase('pt-BR')}, aparece aqui com a
                ação que resolve.
              </EmptyState>
            )}
          </Panel>
        ))}
      </motion.div>
    </div>
  )
}

function useHeadlineOffer(lista: Pendencia[] | undefined): InsightOffer | undefined {
  const analysis = useAnalysis()
  const primeira = lista
    ? agrupar(lista)
        .flatMap(({ itens }) => itens)
        .find((p) => p.acao.credito)
    : undefined
  const credito = primeira?.acao.credito
  if (!primeira || !credito) return undefined
  const oportunidade = analysis.data?.oportunidades.find((o) => o.tipo === credito.produto)
  return {
    produto: credito.produto,
    valor: credito.valor,
    taxa_mensal: oportunidade?.taxa_mensal,
    racional: `Resolve: ${primeira.titulo.toLocaleLowerCase('pt-BR')}.`,
  }
}

/** Pendências: a fila do que pede atenção, por urgência, com a ação e o crédito que resolvem. */
export function PendenciasPage() {
  const api = usePortalApi()
  const pendencias = useQuery({ queryKey: pendenciasKey, queryFn: api.erp.pendencias })
  const analysis = useAnalysis()
  const offer = useHeadlineOffer(pendencias.data)
  const insight = analysis.data?.insights.find((i) => i.area === 'pendencias')

  const header = (
    <PageHeader
      title="Pendências"
      description="O que pede sua atenção, em ordem de urgência, com a ação que resolve."
    />
  )

  if (pendencias.isPending) {
    return (
      <>
        {header}
        <div className="space-y-5">
          <StatStrip
            loading
            stats={['Em atraso', 'Vence hoje', 'Pendências abertas'].map((label) => ({
              label,
              value: null,
            }))}
          />
          <PanelSkeleton rows={5} label="Carregando as pendências…" />
        </div>
      </>
    )
  }

  if (pendencias.isError) {
    return (
      <>
        {header}
        {isOnboardingPendente(pendencias.error) ? (
          <OnboardingPendingState area="A lista de pendências" />
        ) : (
          <ErrorState
            title="Não conseguimos carregar as pendências"
            message={errorMessage(pendencias.error)}
            onRetry={() => void pendencias.refetch()}
          />
        )}
      </>
    )
  }

  const lista = pendencias.data
  if (lista.length === 0) {
    return (
      <>
        {header}
        <Panel>
          <EmptyState
            icon={<CircleCheck aria-hidden className="size-5 text-positive" />}
            title="Tudo em dia"
            action={<ButtonLink to="/app">Ver a visão geral</ButtonLink>}
          >
            Nenhuma conta vencida, caixa coberto e estoque no nível. Quando algo pedir atenção, como
            uma conta vencendo, um item abaixo do mínimo ou uma proposta de crédito, aparece aqui em
            ordem de urgência.
          </EmptyState>
        </Panel>
      </>
    )
  }

  const atraso = soma(lista, 'CONTA_ATRASADA')
  const hoje = soma(lista, 'VENCE_HOJE')
  const agora = lista.filter((p) => grupoDe(p.tipo) === 'agora').length
  const contas = (n: number) => `${n} ${n === 1 ? 'conta' : 'contas'}`

  return (
    <>
      {header}
      <div className="space-y-5">
        <StatStrip
          stats={[
            {
              label: 'Em atraso',
              value: (
                <Money
                  value={atraso.total}
                  size="lg"
                  className={atraso.qtd > 0 ? 'text-negative' : undefined}
                />
              ),
              detail: atraso.qtd > 0 ? contas(atraso.qtd) : 'Nenhuma conta atrasada',
            },
            {
              label: 'Vence hoje',
              value: <Money value={hoje.total} size="lg" />,
              detail: hoje.qtd > 0 ? contas(hoje.qtd) : 'Nada vence hoje',
            },
            {
              label: 'Pendências abertas',
              value: <span className="text-xl">{lista.length}</span>,
              detail: agora > 0 ? `${agora} para resolver agora` : 'Nada urgente',
            },
          ]}
        />
        <InsightBlock insight={insight} offer={offer} />
        <Queue lista={lista} />
      </div>
    </>
  )
}
