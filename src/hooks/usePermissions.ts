import { useAuth0 } from '@auth0/auth0-react'
import { useQuery } from '@tanstack/react-query'

import {
  BACKOFFICE_PERMISSIONS,
  permissionsFromToken,
  STAFF_PERMISSIONS,
  type Permission,
} from '@/auth/permissions'

/** Permissões do usuário logado, lidas do access token emitido pelo Auth0. */
export function usePermissions() {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0()
  const query = useQuery({
    queryKey: ['permissions', user?.sub],
    queryFn: async () => {
      const granted = permissionsFromToken((await getAccessTokenSilently()) ?? '')
      if (granted.length > 0) return granted
      // Signup: o primeiro token pode sair antes de a Action atribuir o perfil "cliente".
      return permissionsFromToken((await getAccessTokenSilently({ cacheMode: 'off' })) ?? '')
    },
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
    isAdmin: BACKOFFICE_PERMISSIONS.every((permission) => permissions.includes(permission)),
    /** Equipe interna (analista, atendente, admin): usa o backoffice. */
    isStaff: STAFF_PERMISSIONS.some((permission) => permissions.includes(permission)),
    /** Empresa cliente: só o portal `/app`. */
    isPortalUser:
      permissions.includes('read:self') &&
      !STAFF_PERMISSIONS.some((permission) => permissions.includes(permission)),
    /** Pode abrir o portal (cliente, ou admin com read:self). */
    canUsePortal: permissions.includes('read:self'),
  }
}
