import { Skeleton } from '../../ui/Surface'

/** Linhas de carregamento dentro de um painel (sem outro cartão por dentro). */
export function RowsSkeleton({ rows, label }: { rows: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 border-t border-line px-5 py-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
