import { useAuth0 } from '@auth0/auth0-react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Building2, LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import { ErpIaLogo } from '@/components/brand/Logo'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/cn'

import { AssistantLauncher } from '../assistant/AssistantLauncher'
import { AssistantProvider } from '../assistant/AssistantProvider'
import { formatCnpj } from '../lib/format'
import { SkipLink } from '../ui/SkipLink'

import { useMembro } from '../team/useMembro'

import { FinanceGate } from './FinanceGate'
import { useRefreshMeOnForbidden } from './financeiro'
import { PORTAL_NAV } from './nav'
import { useMe, useOverview } from './queries'
import { useTheme } from './useTheme'

function NavItems({ pendencias, onNavigate }: { pendencias?: number; onNavigate?: () => void }) {
  const { pode } = useMembro()
  return (
    <ul className="space-y-0.5">
      {PORTAL_NAV.filter((item) => !item.permissao || pode(item.permissao)).map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/app'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex h-9 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11',
                '[&_svg]:size-[18px] [&_svg]:shrink-0',
                isActive
                  ? 'bg-rail-raised text-rail-ink [&_svg]:text-[#C6F24E]'
                  : 'text-rail-muted hover:bg-rail-raised/60 hover:text-rail-ink',
              )
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.to === '/app/pendencias' && !!pendencias && (
              <span className="tabular rounded-full bg-[#C6F24E] px-1.5 text-[11px] leading-[18px] font-semibold text-[#0f1310]">
                {pendencias}
                <span className="sr-only"> pendências</span>
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/** Shell do portal: rail grafite com a navegação e a conta, área de trabalho em papel. */
export function PortalLayout() {
  return (
    <AssistantProvider>
      <PortalShell />
    </AssistantProvider>
  )
}

function PortalShell() {
  const { user, logout } = useAuth0()
  const { isStaff } = usePermissions()
  const queryClient = useQueryClient()
  const { theme, toggle } = useTheme()
  const me = useMe()
  const { pode } = useMembro()
  // Sem `ver_financeiro` o saldo daria 403: nem pede.
  const overview = useOverview(pode('ver_financeiro'))
  useRefreshMeOnForbidden()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(location.pathname)
  // Fecha a gaveta ao navegar (ajuste durante o render, sem efeito).
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname)
    setMenuOpen(false)
  }
  const menuButton = useRef<HTMLButtonElement>(null)
  // Esc fecha a gaveta e devolve o foco ao botão que a abriu.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const empresa = me.data?.empresa
  const conta = overview.data?.conta
  const signOut = () => {
    queryClient.clear()
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const rail = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link to="/app" aria-label="ErpIa, visão geral" className="px-2">
        <ErpIaLogo onDark />
      </Link>

      <div className="rounded-control border border-rail-raised px-3 py-2.5">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-rail-ink">
          <Building2 aria-hidden className="size-4 shrink-0 text-rail-muted" />
          <span className="truncate">{empresa?.nome_fantasia ?? 'Sua empresa'}</span>
        </p>
        {empresa?.cnpj && (
          <p className="tabular mt-0.5 text-xs text-rail-muted">{formatCnpj(empresa.cnpj)}</p>
        )}
        {conta && (
          <p className="tabular mt-0.5 text-xs text-rail-muted">
            Ag. {conta.agencia} · CC {conta.numero}
          </p>
        )}
      </div>

      <nav aria-label="Portal" className="flex-1">
        <NavItems
          pendencias={overview.data?.pendencias_count}
          onNavigate={() => setMenuOpen(false)}
        />
      </nav>

      <div className="space-y-0.5 border-t border-rail-raised pt-4">
        <AssistantLauncher />
        {isStaff && (
          <Link
            to="/"
            className="flex h-9 items-center gap-3 rounded-control px-3 text-sm text-rail-muted hover:bg-rail-raised/60 hover:text-rail-ink pointer-coarse:h-11"
          >
            <ArrowLeftRight aria-hidden className="size-[18px]" />
            Ir para o backoffice
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-full items-center gap-3 rounded-control px-3 text-sm text-rail-muted hover:bg-rail-raised/60 hover:text-rail-ink pointer-coarse:h-11"
        >
          {theme === 'dark' ? (
            <Sun aria-hidden className="size-[18px]" />
          ) : (
            <Moon aria-hidden className="size-[18px]" />
          )}
          {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex h-9 w-full items-center gap-3 rounded-control px-3 text-sm text-rail-muted hover:bg-rail-raised/60 hover:text-rail-ink pointer-coarse:h-11"
        >
          <LogOut aria-hidden className="size-[18px]" />
          Sair
          <span className="ml-auto max-w-28 truncate text-xs">
            {user?.given_name ?? user?.name}
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh bg-rail lg:block">{rail}</aside>

      {/* Telas estreitas: barra no topo + gaveta com o mesmo rail. */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-rail px-4 lg:hidden">
        <Link to="/app" aria-label="ErpIa, visão geral">
          <ErpIaLogo onDark />
        </Link>
        <button
          ref={menuButton}
          type="button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-9 place-items-center rounded-control text-rail-ink hover:bg-rail-raised pointer-coarse:size-11"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {menuOpen && <div className="fixed inset-0 top-14 z-20 bg-rail lg:hidden">{rail}</div>}

      <div className="min-w-0">
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-[84rem] px-4 py-6 outline-none sm:px-8 sm:py-8"
        >
          <FinanceGate>
            <Outlet />
          </FinanceGate>
        </main>
      </div>
    </div>
  )
}
