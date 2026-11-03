import { useAuth0 } from '@auth0/auth0-react'
import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router'

import { MainLayout } from '@/components/layout/MainLayout'
import { Spinner } from '@/components/ui/Spinner'
import { usePermissions } from '@/hooks/usePermissions'
import { HomePage } from '@/pages/HomePage'

// Carregada sob demanda: quem já está logado não baixa a landing nem o motion.
const LandingPage = lazy(() =>
  import('./LandingPage').then((module) => ({ default: module.LandingPage })),
)

/** "/": visitante vê a landing; equipe segue para o início do backoffice; cliente, para o portal. */
export function LandingGate() {
  const { isLoading, isAuthenticated } = useAuth0()
  const { isPortalUser } = usePermissions()

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Carregando sessão…" />
      </div>
    )
  }
  // Empresa cliente (read:self sem permissões de equipe) usa o portal.
  if (isAuthenticated && isPortalUser) return <Navigate to="/app" replace />
  if (isAuthenticated) {
    return (
      <MainLayout>
        <HomePage />
      </MainLayout>
    )
  }
  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  )
}
