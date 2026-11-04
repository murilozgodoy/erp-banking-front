import { Skeleton } from '@/portal/ui/Surface'

/** Linhas de esqueleto dentro de um card (no lugar do spinner no meio do conteúdo). */
export function SkeletonRows({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-1">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i % 3 === 2 ? 'h-3.5 w-2/3' : 'h-3.5 w-full'} />
      ))}
    </div>
  )
}
