import { useAuth0 } from '@auth0/auth0-react'
import { Navigate, useLocation } from 'react-router'

import { ErpIaLogo, Faisca } from '@/components/brand/Logo'
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
    <section className="mx-auto flex max-w-md flex-col gap-8 py-10 sm:py-16">
      <ErpIaLogo size="lg" />
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
          Sua operação, lida por IA. Seu crédito, na hora certa.
        </h1>
        <p className="text-ink-muted">
          ERP com conta PJ, pagamentos e crédito integrados. A ErpIa acompanha vendas, recebíveis e
          contas a pagar e mostra a oportunidade de crédito antes de o caixa apertar.
        </p>
      </div>
      {error && (
        <Alert tone="error" title="Não foi possível entrar">
          {error.message}
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => login()}>Entrar</Button>
        <Button variant="secondary" onClick={() => login(true)}>
          Criar conta da empresa
        </Button>
      </div>
      <p className="flex items-start gap-2 border-t border-line pt-6 text-xs text-ink-muted">
        <Faisca label={null} className="mt-0.5" />
        <span>
          A Faísca marca o que a ErpIa infere a partir dos seus dados: insights, oportunidades e
          valores pré-aprovados. Login seguro via Auth0 (Authorization Code + PKCE).
        </span>
      </p>
    </section>
  )
}
