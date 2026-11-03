import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import { Header } from './Header'

/** `children` substitui o Outlet quando a página é renderizada fora da árvore (ex.: LandingGate). */
export function MainLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">{children ?? <Outlet />}</main>
    </div>
  )
}
