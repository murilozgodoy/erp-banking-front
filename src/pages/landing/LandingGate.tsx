import { useAuth0 } from '@auth0/auth0-react'
import { lazy, Suspense } from 'react'

import { MainLayout } from '@/components/layout/MainLayout'
import { Spinner } from '@/components/ui/Spinner'
import { HomePage } from '@/pages/HomePage'

// Carregada sob demanda: quem já está logado não baixa a landing nem o motion.
const LandingPage = lazy(() =>
  import('./LandingPage').then((module) => ({ default: module.LandingPage })),
)

/** "/": visitante sem sessão vê a landing; usuário logado segue para o início de sempre. */
export function LandingGate() {
  const { isLoading, isAuthenticated } = useAuth0()

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Carregando sessão…" />
      </div>
    )
  }
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
