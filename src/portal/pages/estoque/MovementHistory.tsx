import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, History, PackageMinus, PackagePlus } from 'lucide-react'

import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { money } from '../../lib/format'
import type { InventoryItem, InventoryMovement, InventoryMovementType } from '../../types'
import { EmptyState, ErrorState, Skeleton } from '../../ui/Surface'

import { movementsKey, quandoFoi, quantidadeAssinada, TIPO_INFO, unidades } from './movement'

const ICONE: Record<InventoryMovementType, typeof PackagePlus> = {
  ENTRADA: PackagePlus,
  SAIDA: PackageMinus,
  AJUSTE: ClipboardCheck,
}

const TOM: Record<InventoryMovementType, string> = {
  ENTRADA: 'text-positive',
  SAIDA: 'text-negative',
  AJUSTE: 'text-ink',
}

function Movimento({ movimento }: { movimento: InventoryMovement }) {
  const Icone = ICONE[movimento.tipo]
  return (
    <li className="flex gap-3 py-3.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted">
        <Icone aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-ink">{TIPO_INFO[movimento.tipo].label}</p>
          <p className={cn('tabular text-sm font-semibold whitespace-nowrap', TOM[movimento.tipo])}>
            {quantidadeAssinada(movimento)}
          </p>
        </div>
        <p className="tabular mt-0.5 text-sm text-ink-muted">
          {unidades(movimento.quantidade_anterior)} → {unidades(movimento.quantidade_final)}
          {movimento.custo_unitario !== null && ` · a ${money(movimento.custo_unitario)}/un.`}
        </p>
        {movimento.motivo && (
          <p className="mt-1 text-sm break-words text-ink">{movimento.motivo}</p>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          {movimento.created_by_nome ? `por ${movimento.created_by_nome} · ` : ''}
          <time dateTime={movimento.created_at}>{quandoFoi(movimento.created_at)}</time>
        </p>
      </div>
    </li>
  )
}

/** Histórico do item (`GET /me/inventory/{id}/movements`), do mais recente para o mais antigo. */
export function MovementHistory({ item }: { item: InventoryItem }) {
  const api = usePortalApi()
  const historico = useQuery({
    queryKey: movementsKey(item.id),
    queryFn: () => api.erp.inventoryMovements(item.id),
  })

  if (historico.isPending) {
    return (
      <div role="status" aria-label="Carregando o histórico…" className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3 py-3.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (historico.isError) {
    return (
      <ErrorState
        title="Não conseguimos carregar o histórico"
        message={errorMessage(historico.error)}
        onRetry={() => void historico.refetch()}
      />
    )
  }

  if (historico.data.length === 0) {
    return (
      <EmptyState
        icon={<History aria-hidden className="size-5" />}
        title="Nenhuma movimentação registrada ainda."
      >
        Entradas, saídas e ajustes feitos aqui aparecem nesta lista, com quem fez e o motivo.
      </EmptyState>
    )
  }

  return (
    <section aria-label={`Histórico de ${item.nome}`}>
      <p className="text-xs text-ink-muted">
        {historico.data.length === 1 ? '1 movimentação' : `${historico.data.length} movimentações`},
        da mais recente para a mais antiga.
      </p>
      <ol className="divide-y divide-line">
        {historico.data.map((movimento) => (
          <Movimento key={movimento.id} movimento={movimento} />
        ))}
      </ol>
    </section>
  )
}
