import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type * as Motion from 'motion/react'

import { InsightBlock } from './InsightBlock'
import { useTypewriter } from './useTypewriter'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  useReducedMotion: () => reduced.value,
}))

const texto = 'Seu caixa fica negativo em 18 dias; antecipar R$ 42 mil cobre o vale.'

/** Roteador + React Query: as ações de crédito do InsightBlock leem as permissões do `/me`. */
function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('digitação dos insights', () => {
  it('digita a mensagem, anuncia o texto inteiro e termina sem cursor', async () => {
    reduced.value = false
    render(
      <Providers>
        <InsightBlock
          insight={{ titulo: 'Semana apertada', texto, severidade: 'atencao' }}
          offer={{ produto: 'ANTECIPACAO_RECEBIVEIS', valor: 42000 }}
        />
      </Providers>,
    )
    // Leitores de tela recebem o texto completo de uma vez.
    expect(screen.getByText(texto)).toHaveAttribute('aria-live', 'polite')
    expect(document.querySelector('.insight-caret')).toBeInTheDocument()
    // Sem Faísca repetida ao lado do título.
    expect(screen.getByText('Semana apertada').querySelector('svg')).toBeNull()
    await waitFor(() => expect(screen.getByText(texto)).not.toHaveAttribute('aria-live'), {
      timeout: 4000,
    })
    expect(document.querySelector('.insight-caret')).not.toBeInTheDocument()
  })

  it('com movimento reduzido mostra o texto inteiro de imediato', () => {
    reduced.value = true
    const { result } = renderHook(() => useTypewriter(texto))
    expect(result.current).toEqual({ shown: texto.length, done: true })
  })

  it('texto novo recomeça a digitação', async () => {
    reduced.value = false
    const { result, rerender } = renderHook(({ t }) => useTypewriter(t), {
      initialProps: { t: 'abc' },
    })
    await waitFor(() => expect(result.current.done).toBe(true))
    rerender({ t: 'outro texto' })
    expect(result.current.shown).toBeLessThan('outro texto'.length)
    await waitFor(() => expect(result.current.done).toBe(true))
  })
})
