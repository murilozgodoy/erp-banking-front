import { Auth0Provider, type AppState } from '@auth0/auth0-react'
import { Outlet, useNavigate } from 'react-router'

import { env } from '@/config/env'

/** Fica dentro do roteador para devolver o usuário à rota de origem após o login. */
export function Auth0ProviderWithNavigate() {
  const navigate = useNavigate()

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo ?? '/', { replace: true })
  }

  return (
    <Auth0Provider
      domain={env.auth0.domain}
      clientId={env.auth0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: env.auth0.audience,
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <Outlet />
    </Auth0Provider>
  )
}
