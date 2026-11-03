import { useAuth0 } from '@auth0/auth0-react'
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { permissionsFromToken } from '@/auth/permissions'

import { MockAuthProvider } from './MockAuthProvider'

function Probe() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const [perms, setPerms] = useState('')
  useEffect(() => {
    void getAccessTokenSilently().then((t) => setPerms(permissionsFromToken(t ?? '').join(',')))
  }, [getAccessTokenSilently])
  return (
    <p>
      {String(isAuthenticated)} {user?.name} [{perms}]
    </p>
  )
}

describe('MockAuthProvider (só dev com mocks)', () => {
  it('loga como cliente por padrão, com read:self e write:self', async () => {
    localStorage.removeItem('erpia-mock-perfil')
    render(
      <MockAuthProvider>
        <Probe />
      </MockAuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByText('true Marina Costa [read:self,write:self]')).toBeInTheDocument(),
    )
  })

  it('troca para admin com ?perfil=admin', async () => {
    window.history.pushState({}, '', '/app?perfil=admin')
    render(
      <MockAuthProvider>
        <Probe />
      </MockAuthProvider>,
    )
    await waitFor(() => expect(screen.getByText(/Ana Admin \[read:customers/)).toBeInTheDocument())
    window.history.pushState({}, '', '/')
    localStorage.removeItem('erpia-mock-perfil')
  })
})
