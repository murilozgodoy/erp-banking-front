import { money, number, pct } from '../../lib/format'
import { DataTable, type Column } from '../../ui/DataTable'
import { Panel } from '../../ui/Surface'
import type { SalesReport } from '../../types'

interface ProductRow {
  rank: number
  sku: string
  nome: string
  quantidade: number
  valor: number
  share: number
  /** Largura da barra relativa ao líder do ranking (0–100). */
  bar: number
}

const columns: Column<ProductRow>[] = [
  {
    key: 'rank',
    header: '#',
    cell: (row) => <span className="tabular text-ink-muted">{row.rank}</span>,
    sort: (row) => row.rank,
    className: 'w-10',
  },
  {
    key: 'produto',
    header: 'Produto',
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{row.nome}</span>
        <span className="tabular text-xs text-ink-muted">{row.sku}</span>
      </span>
    ),
    sort: (row) => row.nome.toLocaleLowerCase('pt-BR'),
  },
  {
    key: 'quantidade',
    header: 'Quantidade',
    align: 'right',
    cell: (row) => number(row.quantidade),
    sort: (row) => row.quantidade,
    hideBelow: 'sm',
  },
  {
    key: 'valor',
    header: 'Faturamento',
    align: 'right',
    cell: (row) => money(row.valor),
    sort: (row) => row.valor,
  },
  {
    key: 'share',
    header: '% do total',
    align: 'right',
    cell: (row) => (
      <span className="inline-flex items-center justify-end gap-2.5">
        <span
          aria-hidden
          className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-sunken md:block"
        >
          <span
            className="block h-full rounded-full bg-series-1"
            style={{ width: `${Math.max(row.bar, 2)}%` }}
          />
        </span>
        <span className="w-12">{pct(row.share)}</span>
      </span>
    ),
    sort: (row) => row.share,
    hideBelow: 'md',
  },
]

/** Ranking de produtos por faturamento, com a fatia de cada um no total do período. */
export function TopProducts({ report }: { report: SalesReport }) {
  const leader = Math.max(0, ...report.top_produtos.map((p) => p.valor))
  const rows: ProductRow[] = [...report.top_produtos]
    .sort((a, b) => b.valor - a.valor)
    .map((p, i) => ({
      rank: i + 1,
      sku: p.sku,
      nome: p.nome,
      quantidade: p.quantidade,
      valor: p.valor,
      share: report.total > 0 ? (p.valor / report.total) * 100 : 0,
      bar: leader > 0 ? (p.valor / leader) * 100 : 0,
    }))
  return (
    <Panel
      id="vendas-produtos"
      title="Produtos mais vendidos"
      description="Ranking por faturamento no período. Clique no cabeçalho para reordenar."
      flush
    >
      <DataTable
        caption="Produtos mais vendidos no período"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.sku}
        initialSort={{ key: 'valor', direction: 'desc' }}
        empty={
          <p className="px-5 pb-5 text-sm text-ink-muted">
            O ERP não enviou itens vendidos neste período.
          </p>
        }
      />
    </Panel>
  )
}
