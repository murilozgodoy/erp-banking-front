import { useQuery } from '@tanstack/react-query'

import { ServiceStatusCard } from '@/components/ServiceStatusCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { env } from '@/config/env'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'
import { checkServicesHealth } from '@/services/health'

/** Intervalo do polling dos health checks. */
const MONITORING_INTERVAL_MS = 10_000

interface ToolLink {
  label: string
  description: string
  href: string
}

function toolLinks(): ToolLink[] {
  const links: ToolLink[] = []
  if (env.grafanaUrl) {
    links.push({
      label: 'Grafana',
      description: 'Dashboards: visão geral, serviços, JVM, RabbitMQ, gateway, negócio e k6',
      href: env.grafanaUrl,
    })
  }
  if (env.prometheusUrl) {
    links.push({
      label: 'Prometheus',
      description: 'Alvos de scrape, consultas PromQL e alertas',
      href: `${env.prometheusUrl}/targets`,
    })
  }
  links.push(
    {
      label: 'Swagger — Onboarding API',
      description: 'Documentação interativa (OpenAPI)',
      href: `${env.onboardingApiUrl}/docs`,
    },
    {
      label: 'Swagger — Credit Score API',
      description: 'Documentação interativa (OpenAPI)',
      href: `${env.scoreApiUrl}/docs`,
    },
  )
  return links
}

/** Monitoramento (só admin): saúde dos serviços e do gateway, com links de observabilidade. */
export function MonitoringPage() {
  const { isAdmin, isLoading, error } = usePermissions()

  if (isLoading) return <Spinner label="Verificando permissões…" />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>
  if (!isAdmin) {
    return (
      <Alert tone="warning" title="Acesso negado">
        O monitoramento é restrito ao perfil admin.
      </Alert>
    )
  }
  return <Monitoring />
}

function Monitoring() {
  const health = useQuery({
    queryKey: ['health', 'monitoring'],
    queryFn: () => checkServicesHealth(),
    refetchInterval: MONITORING_INTERVAL_MS,
  })
  const online = health.data?.filter((service) => service.online).length ?? 0

  return (
    <section className="space-y-6">
      <PageHeader
        title="Monitoramento"
        description={`Health checks a cada ${MONITORING_INTERVAL_MS / 1000} s`}
        actions={
          <Button
            variant="secondary"
            loading={health.isFetching}
            onClick={() => void health.refetch()}
          >
            Verificar agora
          </Button>
        }
      />

      <Card
        title="Status dos serviços"
        description={
          health.data
            ? `${online} de ${health.data.length} no ar · última verificação ${new Date(
                health.dataUpdatedAt,
              ).toLocaleTimeString('pt-BR')}`
            : undefined
        }
      >
        {health.data ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {health.data.map((service) => (
              <ServiceStatusCard key={service.name} {...service} />
            ))}
          </ul>
        ) : (
          <Spinner label="Verificando serviços…" />
        )}
      </Card>

      <Card title="Observabilidade" description="Abrem em uma nova aba">
        <ul className="grid gap-3 sm:grid-cols-2">
          {toolLinks().map(({ label, description, href }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow"
              >
                <p className="font-medium text-indigo-700">{label}</p>
                <p className="text-sm text-slate-600">{description}</p>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
