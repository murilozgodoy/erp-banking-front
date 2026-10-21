import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { MainLayout } from './MainLayout'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

describe('MainLayout / Header', () => {
  it('mostra navegação e usuário logado; sair limpa o cache e faz logout', async () => {
    const state = auth0State({ permissions: ['read:customers'] })
    vi.mocked(useAuth0).mockReturnValue(state)
    const { queryClient } = renderPage(<MainLayout />)
    queryClient.setQueryData(['algo'], 1)

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Maria Souza' })).toHaveAttribute('href', '/perfil')

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(queryClient.getQueryData(['algo'])).toBeUndefined()
    expect(state.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })
  })

  it('esconde navegação e usuário sem login', () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ authenticated: false }))
    renderPage(<MainLayout />)

    expect(screen.getByRole('link', { name: 'ERP Banking' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })
})
