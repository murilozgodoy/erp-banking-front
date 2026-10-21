import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, NavLink } from 'react-router'

import type { Permission } from '@/auth/permissions'
import { Button } from '@/components/ui/Button'
import { usePermissions } from '@/hooks/usePermissions'

/** Itens do menu; os que têm `permission` só aparecem para quem pode acessá-los. */
const links: { to: string; label: string; permission?: Permission }[] = [
  { to: '/', label: 'Início' },
]

export function Header() {
  const { isAuthenticated, user, logout } = useAuth0()
  const { can } = usePermissions()
  const queryClient = useQueryClient()

  const signOut = () => {
    queryClient.clear()
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-semibold text-indigo-700">
            ERP Banking
          </Link>
          {isAuthenticated && (
            <nav aria-label="Principal" className="flex gap-4 text-sm">
              {links
                .filter(({ permission }) => !permission || can(permission))
                .map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      isActive
                        ? 'font-medium text-indigo-700'
                        : 'text-slate-600 hover:text-slate-900'
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
            <Link
              to="/perfil"
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            >
              {user?.picture && (
                <img src={user.picture} alt="" className="size-8 rounded-full border" />
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
