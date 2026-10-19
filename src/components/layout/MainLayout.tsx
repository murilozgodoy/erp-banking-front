import { Outlet } from 'react-router'

import { Header } from './Header'

export function MainLayout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
