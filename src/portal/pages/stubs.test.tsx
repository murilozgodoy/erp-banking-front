import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnalisesPage } from '@/pages/analises/AnalisesPage'

import { CreditPage } from './credito/CreditPage'
import { InventoryPage } from './estoque/InventoryPage'
import { OnboardingPage } from './onboarding/OnboardingPage'
import { OverviewPage } from './overview/OverviewPage'
import { PaymentsPage } from './pagamentos/PaymentsPage'
import { PendenciasPage } from './pendencias/PendenciasPage'
import { ReceivablesPage } from './recebiveis/ReceivablesPage'
import { StatusPage } from './status/StatusPage'
import { SalesPage } from './vendas/SalesPage'

// Esqueleto das abas: cada agente substitui a sua página e este teste pela suíte real.
describe('páginas do portal (esqueleto)', () => {
  it.each([
    [OverviewPage, 'Visão geral'],
    [SalesPage, 'Vendas'],
    [ReceivablesPage, 'Recebíveis'],
    [PaymentsPage, 'Pagamentos'],
    [PendenciasPage, 'Pendências'],
    [InventoryPage, 'Estoque'],
    [CreditPage, 'Crédito'],
    [OnboardingPage, 'Cadastro da empresa'],
    [StatusPage, 'Análise do cadastro'],
    [AnalisesPage, 'Fila de análise'],
  ])('%o tem título', (Page, title) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
