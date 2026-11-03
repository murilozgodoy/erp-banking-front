import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'

import { ALL_PERMISSIONS, permissionsFromToken, type Permission } from '@/auth/permissions'

/** Permissões do usuário logado, lidas do access token emitido pelo Auth0. */
export function usePermissions() {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0()
  const query = useQuery({
    queryKey: ['permissions', user?.sub],
    queryFn: async () => permissionsFromToken((await getAccessTokenSilently()) ?? ''),
    enabled: isAuthenticated,
    staleTime: Infinity,
  })
  const permissions = query.data ?? []

  return {
    permissions,
    isLoading: isAuthenticated && query.isPending,
    error: query.error,
    can: (permission: Permission) => permissions.includes(permission),
    /** Perfil admin = todas as permissões do ERP (o Auth0 não expõe o nome do perfil). */
    isAdmin: ALL_PERMISSIONS.every((permission) => permissions.includes(permission)),
  }
}
