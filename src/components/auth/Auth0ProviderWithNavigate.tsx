import { Auth0Provider, type AppState } from '@auth0/auth0-react'
import { Outlet, useNavigate } from 'react-router'

import { env } from '@/config/env'

import { MockAuthProvider } from './MockAuthProvider'

/** Fica dentro do roteador para devolver o usuário à rota de origem após o login. */
export function Auth0ProviderWithNavigate() {
  const navigate = useNavigate()

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo ?? '/', { replace: true })
  }

  // Dev com mocks: login simulado para revisar telas sem o Auth0 (removido do build de produção).
  if (import.meta.env.DEV && env.mockAuth) {
    return (
      <MockAuthProvider>
        <Outlet />
      </MockAuthProvider>
    )
  }

  return (
    <Auth0Provider
      domain={env.auth0.domain}
      clientId={env.auth0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: env.auth0.audience,
      }}
      // Mantém a sessão ao recarregar a página mesmo com cookies de terceiros bloqueados.
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback
      onRedirectCallback={onRedirectCallback}
    >
      <Outlet />
    </Auth0Provider>
  )
}
