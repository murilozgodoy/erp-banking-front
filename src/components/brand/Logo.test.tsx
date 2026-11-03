import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ErpIaLogo, ErpIaMark, Faisca, Marca } from './Logo'

describe('marca ErpIa', () => {
  it('logo tem nome acessível e variante para fundo escuro', () => {
    const { container } = render(<ErpIaLogo onDark size="lg" />)
    expect(screen.getByRole('img', { name: 'ErpIa' })).toBeInTheDocument()
    expect(container.querySelector('rect')).toHaveAttribute('fill', '#1A221D')
  })

  it('desenha o "I" com serifas para "ErpIa" não ler como "Erpla"', () => {
    const { container } = render(<ErpIaLogo />)
    const logo = screen.getByRole('img', { name: 'ErpIa' })
    expect(logo).toHaveTextContent('Erpa')
    const glyph = container.querySelector('[data-glyph="serif-i"]')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph?.parentElement).toHaveTextContent(/^a$/)
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

  it('Marca: nome em texto corrido com o I serifado, lido como "ErpIa"', () => {
    const { container } = render(
      <p>
        A <Marca /> lê a operação.
      </p>,
    )
    expect(container.querySelector('[data-glyph="serif-i"]')).toBeInTheDocument()
    expect(container.querySelector('.sr-only')).toHaveTextContent('ErpIa')
    expect(container.querySelector('[aria-hidden]')).toHaveTextContent('Erpa')
  })
})
