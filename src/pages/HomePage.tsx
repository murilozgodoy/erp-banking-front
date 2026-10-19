import { useEffect, useState } from 'react'

import { ServiceStatusCard } from '@/components/ServiceStatusCard'
import { checkServicesHealth, type ServiceHealth } from '@/services/health'

export function HomePage() {
  const [services, setServices] = useState<ServiceHealth[] | null>(null)

  useEffect(() => {
    let active = true
    checkServicesHealth().then((result) => {
      if (active) setServices(result)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ERP Banking e Crédito</h1>
        <p className="text-slate-600">Status dos microsserviços</p>
      </div>
      {services === null ? (
        <p className="text-slate-500">Verificando serviços…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {services.map((service) => (
            <ServiceStatusCard key={service.name} {...service} />
          ))}
        </ul>
      )}
    </section>
  )
}
