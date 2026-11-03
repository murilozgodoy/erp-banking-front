import type { ServiceHealth } from '@/services/health'

const states = {
  online: { label: 'Online', style: 'bg-positive-soft text-positive' },
  limited: { label: 'Limitado (429)', style: 'bg-warning-soft text-warning' },
  offline: { label: 'Offline', style: 'bg-negative-soft text-negative' },
}

export function ServiceStatusCard({ name, url, online, limited, latencyMs }: ServiceHealth) {
  const state = states[online ? 'online' : limited ? 'limited' : 'offline']
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="truncate text-xs text-ink-muted">{url}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${state.style}`}>
          {state.label}
        </span>
        {latencyMs !== undefined && <span className="text-xs text-ink-muted">{latencyMs} ms</span>}
      </div>
    </li>
  )
}
