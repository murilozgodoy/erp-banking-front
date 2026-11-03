import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Valor para ordenar; sem ele a coluna não é ordenável. */
  sort?: (row: T) => number | string
  align?: 'left' | 'right' | 'center'
  /** Esconde em telas estreitas. */
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  /** Linha selecionável (checkbox na primeira coluna). */
  selection?: {
    selected: Set<string | number>
    onToggle: (key: string | number) => void
    onToggleAll: (keys: (string | number)[]) => void
    isSelectable?: (row: T) => boolean
  }
  empty?: ReactNode
  rowClassName?: (row: T) => string | undefined
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }
const align = { left: 'text-left', right: 'text-right', center: 'text-center' }

/** Tabela densa com cabeçalho fixo, ordenação acessível (aria-sort) e seleção opcional. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  initialSort,
  selection,
  empty,
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort)

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key)
    if (!column?.sort || !sort) return rows
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = column.sort!(a)
      const y = column.sort!(b)
      return (x < y ? -1 : x > y ? 1 : 0) * factor
    })
  }, [rows, columns, sort])

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    )

  const selectableKeys = selection
    ? rows.filter((r) => selection.isSelectable?.(r) ?? true).map(rowKey)
    : []
  const allSelected =
    selectableKeys.length > 0 && selectableKeys.every((k) => selection!.selected.has(k))

  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    // `relative`: sem ele, os `.sr-only` (absolutos) das células escapam da rolagem e alargam a página.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {selection && (
              <th scope="col" className="w-10 py-2.5 pl-5">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allSelected}
                  onChange={() => selection.onToggleAll(selectableKeys)}
                  className="size-4 accent-[var(--erpia-accent)]"
                />
              </th>
            )}
            {columns.map((column, index) => {
              const active = sort?.key === column.key
              const ariaSort = active
                ? sort!.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'bg-surface py-2.5 text-xs font-medium whitespace-nowrap text-ink-muted',
                    align[column.align ?? 'left'],
                    index === 0 && !selection ? 'pl-5' : 'pl-3',
                    index === columns.length - 1 ? 'pr-5' : 'pr-3',
                    column.hideBelow && hide[column.hideBelow],
                  )}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded hover:text-ink',
                        column.align === 'right' && 'flex-row-reverse',
                        active && 'text-ink',
                      )}
                    >
                      {column.header}
                      {active ? (
                        sort!.direction === 'asc' ? (
                          <ArrowUp aria-hidden className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown aria-hidden className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row)
            const selectable = selection ? (selection.isSelectable?.(row) ?? true) : false
            const checked = selection?.selected.has(key) ?? false
            return (
              <tr
                key={key}
                className={cn(
                  'border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-paper',
                  checked && 'bg-accent-soft/60 hover:bg-accent-soft',
                  rowClassName?.(row),
                )}
              >
                {selection && (
                  <td className="py-2.5 pl-5">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${key}`}
                      disabled={!selectable}
                      checked={checked}
                      onChange={() => selection.onToggle(key)}
                      className="size-4 accent-[var(--erpia-accent)] disabled:opacity-40"
                    />
                  </td>
                )}
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      'py-2.5 text-ink',
                      align[column.align ?? 'left'],
                      column.align === 'right' && 'tabular',
                      index === 0 && !selection ? 'pl-5' : 'pl-3',
                      index === columns.length - 1 ? 'pr-5' : 'pr-3',
                      column.hideBelow && hide[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
