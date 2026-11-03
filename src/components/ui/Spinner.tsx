export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-4 text-sm text-ink-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      {label}
    </div>
  )
}
