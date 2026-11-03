import {
  ArrowLeftRight,
  CalendarClock,
  HandCoins,
  LayoutDashboard,
  ListTodo,
  Package,
  TrendingUp,
} from 'lucide-react'
import type { ReactNode } from 'react'

/** Abas do portal, na ordem do rail. */
export const PORTAL_NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/app', label: 'Visão geral', icon: <LayoutDashboard /> },
  { to: '/app/vendas', label: 'Vendas', icon: <TrendingUp /> },
  { to: '/app/recebiveis', label: 'Recebíveis', icon: <CalendarClock /> },
  { to: '/app/pagamentos', label: 'Pagamentos', icon: <ArrowLeftRight /> },
  { to: '/app/pendencias', label: 'Pendências', icon: <ListTodo /> },
  { to: '/app/estoque', label: 'Estoque', icon: <Package /> },
  { to: '/app/credito', label: 'Crédito', icon: <HandCoins /> },
]
