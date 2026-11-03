import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { ErpIaLogo } from '@/components/brand/Logo'
import { env } from '@/config/env'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'

import { ButtonLink } from '../ui/Button'
import { ErrorState, Skeleton } from '../ui/Surface'

import { useMe } from './queries'
import { allowed, portalHome } from './routing'

function GateLoading() {
  return (
    <div
      role="status"
      aria-label="Carregando o portal…"
      className="grid min-h-dvh place-items-center bg-paper"
    >
      <div className="flex flex-col items-center gap-4">
        <ErpIaLogo />
        <Skeleton className="h-1.5 w-40" />
      </div>
    </div>
  )
}

/**
 * Porta do portal: exige `read:self` (ou mocks ligados) e leva o cliente ao passo certo do
 * onboarding conforme o `GET /me`.
 */
export function PortalGate() {
  const { isLoading: authLoading } = useAuth0()
  const { canUsePortal, isLoading: permissionsLoading } = usePermissions()
  const location = useLocation()
  const hasAccess = canUsePortal || env.useMocks
  const me = useMe()

  if (authLoading || permissionsLoading) return <GateLoading />
  if (!hasAccess) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-4">
        <div className="max-w-md space-y-4 text-center">
          <ErpIaLogo className="justify-center" />
          <h1 className="text-xl font-semibold text-ink">Seu perfil não tem acesso ao portal</h1>
          <p className="text-sm text-ink-muted">
            O portal é das empresas clientes (permissão <code>read:self</code>). Se você é da
            equipe, use o backoffice.
          </p>
          <ButtonLink to="/">Ir para o backoffice</ButtonLink>
        </div>
      </div>
    )
  }
  if (me.isPending) return <GateLoading />
  if (me.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="Não conseguimos abrir o portal"
          message={`${errorMessage(me.error)} Verifique a conexão e tente de novo.`}
          onRetry={() => void me.refetch()}
        />
      </div>
    )
  }

  const status = me.data.onboarding_status
  if (!allowed(status, location.pathname)) return <Navigate to={portalHome(status)} replace />
  return <Outlet />
}
