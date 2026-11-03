import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { PackageOpen, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { BarChart } from '../../charts/BarChart'
import { portalKeys, useAnalysis } from '../../layout/queries'
import { isOnboardingPendente } from '../../lib/apiErrors'
import { money, number, pct, relativeDay } from '../../lib/format'
import type { InventoryItem, InventoryReport } from '../../types'
import { ButtonLink } from '../../ui/Button'
import { DataTable, type Column } from '../../ui/DataTable'
import { InsightBlock, type InsightOffer } from '../../ui/InsightBlock'
import { Money } from '../../ui/Money'
import { OnboardingPendingState } from '../../ui/OnboardingPending'
import { Pill } from '../../ui/Pill'
import { Segmented } from '../../ui/Segmented'
import { StatStrip } from '../../ui/StatStrip'
import { EmptyState, ErrorState, PageHeader, Panel, PanelSkeleton } from '../../ui/Surface'

import { custoReposicao, filtrar, porFaixaDeGiro, valorEmEstoque, type Filtro } from './inventory'

const inventoryKey = [...portalKeys.erp, 'inventory'] as const
const offersKey = [...portalKeys.erp, 'credit', 'offers'] as const

function dias(value: number): string {
  return `${number(value)} ${value === 1 ? 'dia' : 'dias'}`
}

function StatusPills({ item }: { item: InventoryItem }) {
  if (!item.abaixo_minimo && !item.parado) return <Pill tone="positive">No nível</Pill>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {item.abaixo_minimo && <Pill tone="negative">Abaixo do mínimo</Pill>}
      {item.parado && <Pill tone="warning">Parado</Pill>}
    </span>
  )
}

const columns: Column<InventoryItem>[] = [
  {
    key: 'item',
    header: 'Item',
    sort: (item) => item.nome.toLocaleLowerCase('pt-BR'),
    cell: (item) => (
      <span className="block min-w-[10rem]">
        <span className="block font-medium text-ink">{item.nome}</span>
        <span className="block text-xs text-ink-faint">{item.sku}</span>
      </span>
    ),
  },
  {
    key: 'quantidade',
    header: 'Em estoque',
    align: 'right',
    sort: (item) => (item.minimo > 0 ? item.quantidade / item.minimo : item.quantidade),
    cell: (item) => (
      <span className="block whitespace-nowrap">
        <span className="font-medium text-ink">{number(item.quantidade)}</span>
        <span className="text-ink-muted"> / mín. {number(item.minimo)}</span>
        {item.abaixo_minimo && (
          <span className="block text-xs text-negative">
            faltam {number(item.minimo - item.quantidade)}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'cobertura',
    header: 'Cobertura',
    align: 'right',
    sort: (item) => item.cobertura_dias,
    cell: (item) => <span className="whitespace-nowrap">{dias(item.cobertura_dias)}</span>,
  },
  {
    key: 'giro',
    header: 'Giro',
    align: 'right',
    hideBelow: 'md',
    sort: (item) => item.giro_dias,
    cell: (item) => <span className="whitespace-nowrap">{dias(item.giro_dias)}</span>,
  },
  {
    key: 'ultima_venda',
    header: 'Última venda',
    hideBelow: 'lg',
    sort: (item) => item.ultima_venda ?? '',
    cell: (item) =>
      item.ultima_venda ? (
        <time dateTime={item.ultima_venda} className="whitespace-nowrap text-ink-muted">
          {relativeDay(item.ultima_venda)}
        </time>
      ) : (
        <span className="text-ink-faint">sem vendas</span>
      ),
  },
  {
    key: 'valor',
    header: 'Valor a custo',
    align: 'right',
    hideBelow: 'sm',
    sort: valorEmEstoque,
    cell: (item) => <Money value={valorEmEstoque(item)} size="sm" className="font-medium" />,
  },
  {
    key: 'status',
    header: 'Situação',
    cell: (item) => <StatusPills item={item} />,
  },
]

function InventorySkeleton() {
  return (
    <div className="space-y-5">
      <StatStrip
        loading
        stats={['Valor em estoque', 'Valor parado', 'Abaixo do mínimo', 'Cobertura média'].map(
          (label) => ({ label, value: null }),
        )}
      />
      <PanelSkeleton rows={3} label="Carregando o estoque…" />
      <PanelSkeleton rows={6} label="Carregando os itens…" />
    </div>
  )
}

function useStockOffer(report: InventoryReport | undefined): InsightOffer | undefined {
  const api = usePortalApi()
  const analysis = useAnalysis()
  const offers = useQuery({
    queryKey: offersKey,
    queryFn: api.erp.offers,
    enabled: !!report,
    staleTime: 60_000,
  })
  if (!report) return undefined
  const offer = offers.data?.find((o) => o.produto === 'FINANCIAMENTO_ESTOQUE')
  const oportunidade = analysis.data?.oportunidades.find((o) => o.tipo === 'FINANCIAMENTO_ESTOQUE')
  const limite = offer?.limite ?? oportunidade?.valor_maximo ?? 0
  if (!(limite > 0)) return undefined
  const baixos = report.itens.filter((item) => item.abaixo_minimo)
  const reposicao = baixos.reduce((acc, item) => acc + custoReposicao(item), 0)
  return {
    produto: 'FINANCIAMENTO_ESTOQUE',
    valor: reposicao > 0 ? Math.min(limite, Math.ceil(reposicao)) : limite,
    taxa_mensal: offer?.taxa_mensal_a_partir ?? oportunidade?.taxa_mensal,
    racional:
      reposicao > 0
        ? `Repor ${baixos.length === 1 ? 'o item' : `os ${baixos.length} itens`} abaixo do mínimo custa ${money(reposicao)}.`
        : oportunidade?.racional,
    cta: 'Simular financiamento',
  }
}

function GiroPanel({ report }: { report: InventoryReport }) {
  const faixas = porFaixaDeGiro(report.itens)
  const share = report.valor_total > 0 ? (report.valor_parado / report.valor_total) * 100 : 0
  return (
    <Panel
      id="estoque-giro"
      title="Capital por velocidade de giro"
      description={
        report.valor_parado > 0 ? (
          <>
            <span className="tabular font-medium text-ink">{money(report.valor_parado)}</span> (
            <span className="tabular">{pct(share, 0)}</span> do estoque) está em itens que levam
            mais de 90 dias para girar.
          </>
        ) : (
          'Todo o estoque gira em até 90 dias.'
        )
      }
    >
      <BarChart
        title="Valor em estoque a custo por faixa de giro"
        height={200}
        highlightColor="var(--color-warning)"
        data={faixas.map((faixa) => ({
          key: faixa.key,
          label: faixa.label,
          value: faixa.valor,
          highlight: faixa.parado && faixa.valor > 0,
          detail: `${faixa.itens} ${faixa.itens === 1 ? 'item' : 'itens'}`,
        }))}
      />
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-series-1" />
          Girando (até 90 dias)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-warning" />
          Parado (mais de 90 dias)
        </span>
      </p>
    </Panel>
  )
}

function ItemsPanel({ report }: { report: InventoryReport }) {
  const reduce = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const sku = params.get('sku')
  const destaque = sku ? report.itens.find((item) => item.sku === sku) : undefined
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const rows = useMemo(() => filtrar(report.itens, filtro), [report.itens, filtro])
  const parados = report.itens.filter((item) => item.parado).length

  const empty: Record<Filtro, { title: string; text: string }> = {
    todos: { title: '', text: '' },
    abaixo: {
      title: 'Nenhum item abaixo do mínimo',
      text: 'Todos os itens estão no nível de reposição. Ajuste os mínimos no ERP quando a demanda mudar.',
    },
    parados: {
      title: 'Nenhum item parado',
      text: 'Todos os itens venderam nos últimos 90 dias. Capital girando é caixa disponível.',
    },
  }

  return (
    <Panel
      id="estoque-itens"
      title="Itens"
      description={`${report.itens.length} itens cadastrados. Cobertura é por quantos dias o saldo atual atende as vendas.`}
      actions={
        <Segmented<Filtro>
          label="Filtrar itens"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todos', label: `Todos (${report.itens.length})` },
            { value: 'abaixo', label: `Abaixo do mínimo (${report.abaixo_minimo})` },
            { value: 'parados', label: `Parados (${parados})` },
          ]}
        />
      }
      flush
    >
      {destaque && (
        <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-control bg-accent-soft px-3 py-2 text-sm text-ink">
          <span>
            Destacando <span className="font-medium">{destaque.nome}</span>
          </span>
          <button
            type="button"
            onClick={() => setParams({}, { replace: true })}
            className="inline-flex items-center gap-1 rounded text-ink-muted hover:text-ink"
          >
            <X aria-hidden className="size-4" />
            Limpar destaque
          </button>
        </div>
      )}
      <motion.div
        key={filtro}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <DataTable
          caption="Itens de estoque com quantidade, mínimo, cobertura, giro e situação"
          columns={columns}
          rows={rows}
          rowKey={(item) => item.sku}
          initialSort={{ key: 'valor', direction: 'desc' }}
          rowClassName={(item) => (item.sku === sku ? 'bg-accent-soft/60' : undefined)}
          empty={
            filtro !== 'todos' ? (
              <EmptyState title={empty[filtro].title}>{empty[filtro].text}</EmptyState>
            ) : undefined
          }
        />
      </motion.div>
    </Panel>
  )
}

/** Estoque: capital empatado, o que repor, o que está parado e como financiar a reposição. */
export function InventoryPage() {
  const api = usePortalApi()
  const inventory = useQuery({ queryKey: inventoryKey, queryFn: api.erp.inventory })
  const analysis = useAnalysis()
  const offer = useStockOffer(inventory.data)
  const insight = analysis.data?.insights.find((i) => i.area === 'estoque')

  const header = (
    <PageHeader
      title="Estoque"
      description="Quanto capital está na prateleira, o que precisa de reposição e o que não gira."
    />
  )

  if (inventory.isPending) {
    return (
      <>
        {header}
        <InventorySkeleton />
      </>
    )
  }

  if (inventory.isError) {
    return (
      <>
        {header}
        {isOnboardingPendente(inventory.error) ? (
          <OnboardingPendingState area="O estoque" />
        ) : (
          <ErrorState
            title="Não conseguimos carregar o estoque"
            message={errorMessage(inventory.error)}
            onRetry={() => void inventory.refetch()}
          />
        )}
      </>
    )
  }

  const report = inventory.data
  if (report.itens.length === 0) {
    return (
      <>
        {header}
        <Panel>
          <EmptyState
            icon={<PackageOpen aria-hidden className="size-5" />}
            title="Nenhum item de estoque ainda"
            action={<ButtonLink to="/app">Voltar à visão geral</ButtonLink>}
          >
            Quando o ERP registrar seus produtos, esta aba mostra o capital empatado, o giro de cada
            item, quantos dias o saldo cobre e o que está abaixo do mínimo. Se sua empresa não
            trabalha com estoque físico, pode ignorar esta área.
          </EmptyState>
        </Panel>
      </>
    )
  }

  const reposicao = report.itens.reduce((acc, item) => acc + custoReposicao(item), 0)
  const parados = report.itens.filter((item) => item.parado).length
  const share = report.valor_total > 0 ? (report.valor_parado / report.valor_total) * 100 : 0

  return (
    <>
      {header}
      <div className="space-y-5">
        <StatStrip
          stats={[
            {
              label: 'Valor em estoque',
              value: <Money value={report.valor_total} size="lg" />,
              detail: `${report.itens.length} itens, a preço de custo`,
            },
            {
              label: 'Valor parado',
              value: <Money value={report.valor_parado} size="lg" />,
              detail: `${pct(share, 0)} do estoque · ${parados} ${parados === 1 ? 'item' : 'itens'} com giro > 90 dias`,
            },
            {
              label: 'Abaixo do mínimo',
              value: (
                <span className="text-xl">
                  {report.abaixo_minimo} {report.abaixo_minimo === 1 ? 'item' : 'itens'}
                </span>
              ),
              detail:
                reposicao > 0 ? `Repor custa ${money(reposicao)}` : 'Tudo no nível de reposição',
            },
            {
              label: 'Cobertura média',
              value: <span className="text-xl">{number(report.cobertura_media_dias, 1)} dias</span>,
              detail: 'No ritmo atual de vendas',
            },
          ]}
        />
        <InsightBlock insight={insight} offer={offer} />
        <GiroPanel report={report} />
        <ItemsPanel report={report} />
      </div>
    </>
  )
}
