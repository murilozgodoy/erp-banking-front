import type { ServiceHealth } from '@/services/health'

export function ServiceStatusCard({ name, url, online }: ServiceHealth) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-slate-500">{url}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          online ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {online ? 'Online' : 'Offline'}
      </span>
    </li>
  )
}
