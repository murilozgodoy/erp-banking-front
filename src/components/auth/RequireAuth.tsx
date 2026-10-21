import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { Spinner } from '@/components/ui/Spinner'

/** Rotas filhas só para usuários logados; os demais vão para /login e voltam depois. */
export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth0()
  const location = useLocation()

  if (isLoading) return <Spinner label="Carregando sessão…" />
  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search }} />
    )
  }
  return <Outlet />
}
