import { useAuth0 } from '@auth0/auth0-react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { auth0State } from '@/test/auth0'

import { setMembroLogado } from '../mocks/team'
import { renderPortal, useMockApi } from '../test/portal'

import { GatedButton, GatedButtonLink } from './Gated'

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }))

function Acoes({ onPagar }: { onPagar: () => void }) {
  return (
    <>
      <GatedButton permissao="pagar" onClick={onPagar}>
        Pagar
      </GatedButton>
      <GatedButtonLink permissao="pedir_credito" to="/app/credito">
        Simular
      </GatedButtonLink>
    </>
  )
}

describe('ações com permissão (seção 11)', () => {
  useMockApi('APROVADO')
  afterEach(() => setMembroLogado(null))

  it('com permissão, o botão funciona normalmente', async () => {
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
    const onPagar = vi.fn()
    renderPortal(<Acoes onPagar={onPagar} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar' }))
    expect(onPagar).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Simular' })).toHaveAttribute('href', '/app/credito')
  })

  it('sem permissão, fica desabilitado com o motivo em tooltip, sem sumir', async () => {
    setMembroLogado('LEITURA')
    vi.mocked(useAuth0).mockReturnValue(auth0State({ permissions: ['read:self', 'write:self'] }))
    const onPagar = vi.fn()
    renderPortal(<Acoes onPagar={onPagar} />)
    // O botão troca quando o GET /me (com o membro) chega.
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pagar' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    const pagar = screen.getByRole('button', { name: 'Pagar' })
    expect(pagar).toHaveAccessibleDescription('Peça a um administrador a permissão de pagar.')
    await userEvent.click(pagar)
    expect(onPagar).not.toHaveBeenCalled()
    const simular = screen.getByRole('link', { name: 'Simular' })
    expect(simular).toHaveAttribute('aria-disabled', 'true')
    expect(simular).not.toHaveAttribute('href')
    expect(simular).toHaveAccessibleDescription(
      'Peça a um administrador a permissão de pedir crédito.',
    )
  })
})
