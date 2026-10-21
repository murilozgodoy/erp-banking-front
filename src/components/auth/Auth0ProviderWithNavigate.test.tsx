import type { Auth0ProviderOptions } from '@auth0/auth0-react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Auth0ProviderWithNavigate } from './Auth0ProviderWithNavigate'

let providerProps: Auth0ProviderOptions | undefined

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: (props: Auth0ProviderOptions) => {
    providerProps = props
    return props.children
  },
}))

function Where() {
  return <p>em {useLocation().pathname}</p>
}

describe('Auth0ProviderWithNavigate', () => {
  it('configura o Auth0 com a audience da API e volta à rota de origem após o login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Auth0ProviderWithNavigate />}>
            <Route path="*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(providerProps).toMatchObject({
      domain: 'test.auth0.com',
      clientId: 'test-client-id',
      authorizationParams: { audience: 'https://erp-banking-api' },
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
    })

    act(() => providerProps?.onRedirectCallback?.({ returnTo: '/perfil' }))
    expect(screen.getByText('em /perfil')).toBeInTheDocument()

    act(() => providerProps?.onRedirectCallback?.())
    expect(screen.getByText('em /')).toBeInTheDocument()
  })
})
