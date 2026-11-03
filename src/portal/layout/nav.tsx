import {
  ArrowLeftRight,
  CalendarClock,
  HandCoins,
  LayoutDashboard,
  ListTodo,
  Package,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { Permissao } from '../types'

/** Abas do portal, na ordem do rail. */
/** `permissao`: o item só aparece para quem a tem (seção 11). */
export const PORTAL_NAV: { to: string; label: string; icon: ReactNode; permissao?: Permissao }[] = [
  { to: '/app', label: 'Visão geral', icon: <LayoutDashboard /> },
  { to: '/app/vendas', label: 'Vendas', icon: <TrendingUp /> },
  { to: '/app/recebiveis', label: 'Recebíveis', icon: <CalendarClock /> },
  { to: '/app/pagamentos', label: 'Pagamentos', icon: <ArrowLeftRight /> },
  { to: '/app/pendencias', label: 'Pendências', icon: <ListTodo /> },
  { to: '/app/estoque', label: 'Estoque', icon: <Package /> },
  { to: '/app/credito', label: 'Crédito', icon: <HandCoins /> },
  { to: '/app/equipe', label: 'Equipe', icon: <UsersRound />, permissao: 'gerenciar_equipe' },
]
