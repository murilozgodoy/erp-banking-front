import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, useLocation } from 'react-router'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function LoginPage() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/'

  if (isLoading) return <Spinner label="Carregando sessão…" />
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const login = (signup = false) =>
    loginWithRedirect({
      appState: { returnTo },
      authorizationParams: signup ? { screen_hint: 'signup' } : undefined,
    })

  return (
    <section className="mx-auto max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ERP Banking e Crédito</h1>
        <p className="text-slate-600">
          Entre com sua conta para cadastrar clientes, avaliar score e operar contas e crédito.
        </p>
      </div>
      {error && (
        <Alert tone="error" title="Não foi possível entrar">
          {error.message}
        </Alert>
      )}
      <div className="flex gap-3">
        <Button onClick={() => login()}>Entrar</Button>
        <Button variant="secondary" onClick={() => login(true)}>
          Criar conta
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Autenticação via Auth0 (OAuth 2.0 com Authorization Code + PKCE). O que cada perfil pode
        fazer é definido pelas permissões atribuídas no Auth0.
      </p>
    </section>
  )
}
