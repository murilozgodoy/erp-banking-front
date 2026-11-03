import { Auth0Context, type Auth0ContextInterface, type User } from '@auth0/auth0-react'
import { useMemo, type ReactNode } from 'react'

/** JWT não assinado: os mocks MSW não validam assinatura, só o front decodifica as permissões. */
function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`
}

/** Perfis do login simulado (`?perfil=` na URL): cliente do portal ou admin. */
const PERFIS: Record<string, string[]> = {
  cliente: ['read:self', 'write:self'],
  admin: [
    'read:customers',
    'write:customers',
    'read:scores',
    'write:scores',
    'read:accounts',
    'write:accounts',
    'read:credits',
    'write:credits',
    'review:onboarding',
    'read:self',
    'write:self',
  ],
}

function perfilAtual(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('perfil')
    if (fromUrl && PERFIS[fromUrl]) localStorage.setItem('erpia-mock-perfil', fromUrl)
    return localStorage.getItem('erpia-mock-perfil') ?? 'cliente'
  } catch {
    return 'cliente'
  }
}

/**
 * Login simulado SÓ para desenvolvimento com mocks (`VITE_MOCK_AUTH=true` + `npm run dev`):
 * permite ver o portal sem o Auth0. Nunca entra no build de produção (ver main/routes).
 */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const perfil = perfilAtual()
    const user: User = {
      sub: `mock|${perfil}`,
      name: perfil === 'admin' ? 'Ana Admin' : 'Marina Costa',
      given_name: perfil === 'admin' ? 'Ana' : 'Marina',
      email: `${perfil}@erpia.dev`,
      email_verified: true,
    }
    const token = unsignedJwt({ sub: user.sub, permissions: PERFIS[perfil] })
    const noop = async () => undefined
    return {
      isAuthenticated: true,
      isLoading: false,
      user,
      error: undefined,
      getAccessTokenSilently: async () => token,
      getAccessTokenWithPopup: async () => token,
      getIdTokenClaims: async () => undefined,
      loginWithRedirect: noop,
      loginWithPopup: noop,
      connectAccountWithRedirect: noop,
      logout: async () => {
        window.location.assign('/')
      },
      handleRedirectCallback: async () => ({}),
    } as unknown as Auth0ContextInterface<User>
  }, [])
  return <Auth0Context.Provider value={value}>{children}</Auth0Context.Provider>
}
