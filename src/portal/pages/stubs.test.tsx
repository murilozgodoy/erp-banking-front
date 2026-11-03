import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OnboardingPage } from './onboarding/OnboardingPage'

// Esqueleto das abas: cada agente substitui a sua página e este teste pela suíte real.
describe('páginas do portal (esqueleto)', () => {
  it.each([[OnboardingPage, 'Cadastro da empresa']])('%o tem título', (Page, title) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
