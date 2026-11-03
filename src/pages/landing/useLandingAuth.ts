import { useAuth0 } from '@auth0/auth0-react'

/** Ações de autenticação da landing: cadastro abre o Universal Login já na tela de signup. */
export function useLandingAuth() {
  const { loginWithRedirect } = useAuth0()
  return {
    signup: () => loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } }),
    login: () => loginWithRedirect(),
  }
}
