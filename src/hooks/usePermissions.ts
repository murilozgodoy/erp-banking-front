import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'

import { permissionsFromToken, type Permission } from '@/auth/permissions'

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
  }
}
