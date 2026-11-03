import { useAuth0 } from '@auth0/auth0-react'
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { setMembroLogado } from '../../mocks/team'
import { renderPortal, useMockApi } from '../../test/portal'

import { PortalProfilePage } from './PortalProfilePage'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

describe('Meu perfil no portal', () => {
  useMockApi('APROVADO')
  afterEach(() => setMembroLogado(null))

  it('mostra a pessoa, o papel e as permissões da equipe (não as do Auth0)', async () => {
    setMembroLogado('OPERADOR')
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
    renderPortal(<PortalProfilePage />, { route: '/app/perfil', path: '/app/perfil' })
    expect(await screen.findByText('Júlia Santos')).toBeInTheDocument()
    expect(screen.getByText('compras@aurorapaes.com.br')).toBeInTheDocument()
    expect(screen.getByText('Operador')).toBeInTheDocument()
    expect(screen.getByText('R$ 2.000,00')).toBeInTheDocument()
    const lista = screen.getByRole('region', { name: 'O que você pode fazer' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(8)
    const item = (texto: string) =>
      within(lista).getByText((_, el) => el?.tagName === 'P' && el.textContent === texto)
    expect(item('Pagar: permitido')).toBeInTheDocument()
    expect(item('Gerenciar equipe: sem permissão')).toBeInTheDocument()
    expect(screen.queryByText('read:customers')).not.toBeInTheDocument()
  })
})
