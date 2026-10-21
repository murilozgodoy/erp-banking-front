import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderPage } from '@/test/render'

import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('oferece o caminho de volta', () => {
    renderPage(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })
})
