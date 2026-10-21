import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import type { Permission } from '@/auth/permissions'
import { ServiceStatusCard } from '@/components/ServiceStatusCard'
import { Alert } from '@/components/ui/Alert'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'
import { checkServicesHealth } from '@/services/health'

/** Atalhos do painel, exibidos conforme as permissões do usuário. */
const modules: { to: string; title: string; description: string; permission: Permission }[] = [
  {
    to: '/clientes',
    title: 'Clientes',
    description: 'Cadastro, anamnese financeira e score de crédito',
    permission: 'read:customers',
  },
  {
    to: '/contas',
    title: 'Contas',
    description: 'Abertura de contas, transações e extratos',
    permission: 'read:accounts',
  },
  {
    to: '/creditos',
    title: 'Crédito',
    description: 'Pedidos de crédito decididos a partir do score',
    permission: 'read:credits',
  },
]

export function HomePage() {
  const { user } = useAuth0()
  const { permissions, isLoading, error } = usePermissions()
  const health = useQuery({ queryKey: ['health'], queryFn: () => checkServicesHealth() })

  const firstName = user?.given_name ?? user?.name?.split(' ')[0] ?? user?.email
  const available = modules.filter(({ permission }) => permissions.includes(permission))

  return (
    <section className="space-y-8">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : 'Olá'}
        description="Painel do ERP Banking e Crédito"
      />

      {error && <Alert tone="error">{errorMessage(error)}</Alert>}
      {!error && !isLoading && permissions.length === 0 && (
        <Alert tone="warning" title="Sua conta ainda não tem um perfil">
          Peça a um administrador para atribuir um perfil (admin, analista ou atendente) no Auth0.
          Depois, saia e entre novamente para receber as novas permissões.
        </Alert>
      )}

      {available.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {available.map(({ to, title, description }) => (
            <Link
              key={to}
              to={to}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <p className="font-semibold text-indigo-700">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Status dos microsserviços</h2>
        {health.data ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {health.data.map((service) => (
              <ServiceStatusCard key={service.name} {...service} />
            ))}
          </ul>
        ) : (
          <Spinner label="Verificando serviços…" />
        )}
      </div>
    </section>
  )
}
