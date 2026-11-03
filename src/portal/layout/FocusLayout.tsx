import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Moon, Sun } from 'lucide-react'
import { Outlet } from 'react-router'

import { ErpIaLogo } from '@/components/brand/Logo'

import { SkipLink } from '../ui/SkipLink'

import { useTheme } from './useTheme'

/** Layout enxuto do onboarding e da análise: só a marca e a saída, sem a navegação do ERP. */
export function FocusLayout() {
  const { logout } = useAuth0()
  const queryClient = useQueryClient()
  const { theme, toggle } = useTheme()
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SkipLink />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <ErpIaLogo />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
              className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:size-11"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.clear()
                logout({ logoutParams: { returnTo: window.location.origin } })
              }}
              className="flex h-9 items-center gap-2 rounded-control px-3 text-sm text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:h-11"
            >
              <LogOut aria-hidden className="size-4" />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-8 outline-none sm:px-6 sm:py-12"
      >
        <Outlet />
      </main>
    </div>
  )
}
