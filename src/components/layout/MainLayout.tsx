import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import { SkipLink } from '@/portal/ui/SkipLink'

import { Header } from './Header'

/** `children` substitui o Outlet quando a página é renderizada fora da árvore (ex.: LandingGate). */
export function MainLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SkipLink />
      <Header />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
