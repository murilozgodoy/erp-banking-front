import type { ReactNode } from 'react'

import type { Permission } from '@/auth/permissions'
import { usePermissions } from '@/hooks/usePermissions'

interface CanProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

/** Renderiza `children` só se o usuário tiver a permissão (ex.: botões de escrita). */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions()
  return can(permission) ? children : fallback
}
