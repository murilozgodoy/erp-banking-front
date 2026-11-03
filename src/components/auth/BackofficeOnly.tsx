import { Navigate, Outlet, useLocation } from 'react-router'

import { Spinner } from '@/components/ui/Spinner'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * Rotas do backoffice: a empresa cliente (read:self sem permissões de equipe interna) não entra;
 * vai para o portal. O perfil tem uma versão no portal (`/app/perfil`).
 */
export function BackofficeOnly() {
  const { isPortalUser, isLoading } = usePermissions()
  const location = useLocation()
  if (isLoading) return <Spinner label="Carregando permissões…" />
  if (isPortalUser) {
    return <Navigate to={location.pathname === '/perfil' ? '/app/perfil' : '/app'} replace />
  }
  return <Outlet />
}
