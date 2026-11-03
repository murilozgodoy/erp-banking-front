import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnalisesPage } from '@/pages/analises/AnalisesPage'

import { CreditPage } from './credito/CreditPage'
import { OnboardingPage } from './onboarding/OnboardingPage'
import { PaymentsPage } from './pagamentos/PaymentsPage'
import { ReceivablesPage } from './recebiveis/ReceivablesPage'

// Esqueleto das abas: cada agente substitui a sua página e este teste pela suíte real.
describe('páginas do portal (esqueleto)', () => {
  it.each([
    [ReceivablesPage, 'Recebíveis'],
    [PaymentsPage, 'Pagamentos'],
    [CreditPage, 'Crédito'],
    [OnboardingPage, 'Cadastro da empresa'],
    [AnalisesPage, 'Fila de análise'],
  ])('%o tem título', (Page, title) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
