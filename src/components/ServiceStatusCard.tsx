import type { ServiceHealth } from '@/services/health'

const states = {
  online: { label: 'Online', style: 'bg-emerald-100 text-emerald-700' },
  limited: { label: 'Limitado (429)', style: 'bg-amber-100 text-amber-800' },
  offline: { label: 'Offline', style: 'bg-red-100 text-red-700' },
}

export function ServiceStatusCard({ name, url, online, limited, latencyMs }: ServiceHealth) {
  const state = states[online ? 'online' : limited ? 'limited' : 'offline']
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="truncate text-xs text-slate-500">{url}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${state.style}`}>
          {state.label}
        </span>
        {latencyMs !== undefined && <span className="text-xs text-slate-500">{latencyMs} ms</span>}
      </div>
    </li>
  )
}
