import { NavLink } from 'react-router'

const links = [{ to: '/', label: 'Início' }]

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold text-indigo-700">ERP Banking</span>
        <nav className="flex gap-4 text-sm">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'font-medium text-indigo-700' : 'text-slate-600 hover:text-slate-900'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
