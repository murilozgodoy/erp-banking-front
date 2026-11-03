import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnalisesPage } from '@/pages/analises/AnalisesPage'

import { OnboardingPage } from './onboarding/OnboardingPage'
import { OverviewPage } from './overview/OverviewPage'
import { PaymentsPage } from './pagamentos/PaymentsPage'
import { PendenciasPage } from './pendencias/PendenciasPage'
import { SalesPage } from './vendas/SalesPage'

// Esqueleto das abas: cada agente substitui a sua página e este teste pela suíte real.
describe('páginas do portal (esqueleto)', () => {
  it.each([
    [OverviewPage, 'Visão geral'],
    [SalesPage, 'Vendas'],
    [PaymentsPage, 'Pagamentos'],
    [PendenciasPage, 'Pendências'],
    [OnboardingPage, 'Cadastro da empresa'],
    [AnalisesPage, 'Fila de análise'],
  ])('%o tem título', (Page, title) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
