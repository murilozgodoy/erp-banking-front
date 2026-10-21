import type { ReactNode } from 'react'

import { PERMISSIONS, type Permission } from '@/auth/permissions'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'

interface RequirePermissionProps {
  permission: Permission
  children: ReactNode
}

/** Protege uma página inteira: sem a permissão, explica o que falta em vez de renderizar. */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, isLoading, error } = usePermissions()

  if (isLoading) return <Spinner label="Verificando permissões…" />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>
  if (!can(permission)) {
    return (
      <Alert tone="warning" title="Acesso negado">
        Esta página exige a permissão <code className="font-mono">{permission}</code> (
        {PERMISSIONS[permission].toLowerCase()}). Peça a um administrador para atribuir o perfil
        adequado no Auth0.
      </Alert>
    )
  }
  return children
}
