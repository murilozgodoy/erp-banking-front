import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ErpIaLogo, ErpIaMark, Faisca } from './Logo'

describe('marca ErpIa', () => {
  it('logo tem nome acessível e variante para fundo escuro', () => {
    const { container } = render(<ErpIaLogo onDark size="lg" />)
    expect(screen.getByRole('img', { name: 'ErpIa' })).toBeInTheDocument()
    expect(container.querySelector('rect')).toHaveAttribute('fill', '#1A221D')
  })

  it('símbolo é decorativo sem título e nomeado com título', () => {
    const { container, rerender } = render(<ErpIaMark />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    rerender(<ErpIaMark title="ErpIa" />)
    expect(screen.getByRole('img', { name: 'ErpIa' })).toBeInTheDocument()
  })

  it('Faísca diz que é inferência da IA, ou fica oculta quando o texto já diz', () => {
    const { container, rerender } = render(<Faisca />)
    expect(screen.getByRole('img', { name: 'Sugerido pela ErpIa' })).toBeInTheDocument()
    rerender(<Faisca label={null} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
