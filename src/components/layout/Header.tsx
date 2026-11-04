import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, NavLink } from 'react-router'

import type { Permission } from '@/auth/permissions'
import { ErpIaLogo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { usePermissions } from '@/hooks/usePermissions'

/** Itens do menu; os que têm `permission` só aparecem para quem pode acessá-los. */
const links: { to: string; label: string; permission?: Permission; admin?: boolean }[] = [
  { to: '/', label: 'Início' },
  { to: '/clientes', label: 'Clientes', permission: 'read:customers' },
  { to: '/contas', label: 'Contas', permission: 'read:accounts' },
  { to: '/creditos', label: 'Crédito', permission: 'read:credits' },
  { to: '/analises', label: 'Fila de análise', permission: 'review:onboarding' },
  { to: '/monitoramento', label: 'Monitoramento', admin: true },
]

export function Header() {
  const { isAuthenticated, user, logout } = useAuth0()
  const { can, isAdmin, canUsePortal, isStaff } = usePermissions()
  const queryClient = useQueryClient()

  const signOut = () => {
    queryClient.clear()
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link to="/" aria-label="ErpIa, início" className="rounded-control">
            <ErpIaLogo className="[&>span]:text-lg" />
          </Link>
          {isAuthenticated && (
            <nav aria-label="Principal" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {links
                .filter(
                  ({ permission, admin }) =>
                    (!permission || can(permission)) && (!admin || isAdmin),
                )
                .map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex items-center rounded-control pointer-coarse:min-h-11',
                        isActive ? 'font-medium text-accent' : 'text-ink-muted hover:text-ink',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
            </nav>
          )}
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {/* Seletor só para a equipe interna que também acessa o portal (admin). */}
            {isStaff && canUsePortal && (
              <nav
                aria-label="Área"
                className="flex rounded-control border border-line bg-sunken p-0.5 text-xs font-medium"
              >
                <span
                  aria-current="page"
                  className="rounded-[5px] bg-surface px-2.5 py-1 text-ink shadow-sm pointer-coarse:py-3"
                >
                  Backoffice
                </span>
                <Link
                  to="/app"
                  className="rounded-[5px] px-2.5 py-1 text-ink-muted hover:text-ink pointer-coarse:py-3"
                >
                  Portal
                </Link>
              </nav>
            )}
            <Link
              to="/perfil"
              className="flex items-center gap-2 rounded-control text-sm text-ink hover:text-accent pointer-coarse:min-h-11"
            >
              {user?.picture && (
                <img src={user.picture} alt="" className="size-8 rounded-full border border-line" />
              )}
              <span>{user?.name ?? user?.email}</span>
            </Link>
            <Button variant="ghost" onClick={signOut}>
              Sair
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
