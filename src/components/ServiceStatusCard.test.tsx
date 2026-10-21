import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ServiceStatusCard } from './ServiceStatusCard'

describe('ServiceStatusCard', () => {
  it('mostra o serviço online', () => {
    render(<ServiceStatusCard name="Onboarding API" url="http://onboarding.test" online />)

    expect(screen.getByText('Onboarding API')).toBeInTheDocument()
    expect(screen.getByText('http://onboarding.test')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('mostra o serviço offline', () => {
    render(<ServiceStatusCard name="Credit Score API" url="http://score.test" online={false} />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })
})
