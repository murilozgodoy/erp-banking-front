import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'
import { renderPage } from '@/test/render'

import { ProfilePage } from './ProfilePage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

describe('ProfilePage', () => {
  it('mostra a conta e as permissões concedidas', async () => {
    vi.mocked(useAuth0).mockReturnValue(
      auth0State({ permissions: ['read:customers', 'write:scores'] }),
    )
    renderPage(<ProfilePage />)

    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('maria@erp.test')).toBeInTheDocument()
    expect(
      await screen.findByText('2 de 8 permissões concedidas pelo seu perfil'),
    ).toBeInTheDocument()

    const granted = screen.getByText('read:customers').closest('li')!
    expect(within(granted).getByText('concedida')).toBeInTheDocument()
    const denied = screen.getByText('write:credits').closest('li')!
    expect(within(denied).getByText('não concedida')).toBeInTheDocument()
  })

  it('copia o access token (apenas em desenvolvimento)', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const state = auth0State({ permissions: [] })
    vi.mocked(useAuth0).mockReturnValue(state)
    renderPage(<ProfilePage />)

    await user.click(screen.getByRole('button', { name: 'Copiar access token' }))

    expect(writeText).toHaveBeenCalledWith(await state.getAccessTokenSilently())
    expect(screen.getByRole('button', { name: 'Token copiado!' })).toBeInTheDocument()
  })

  it('mostra erro ao ler permissões', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ tokenError: new Error('falhou') }))
    renderPage(<ProfilePage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('falhou')
  })
})
