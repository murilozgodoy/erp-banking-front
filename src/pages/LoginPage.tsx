import { useAuth0 } from '@auth0/auth0-react'

const buttonClass = 'rounded-lg px-4 py-2 text-sm font-medium'

export function LoginPage() {
  const { isLoading, isAuthenticated, error, user, loginWithRedirect, logout } = useAuth0()

  const login = () => loginWithRedirect({ appState: { returnTo: '/login' } })
  const signup = () =>
    loginWithRedirect({
      appState: { returnTo: '/login' },
      authorizationParams: { screen_hint: 'signup' },
    })

  if (isLoading) return <p className="text-slate-500">Carregando…</p>

  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Login</h1>

      {isAuthenticated ? (
        <>
          <p className="text-slate-600">Logado como {user?.email}</p>
          <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
          <button
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            className={`${buttonClass} bg-slate-200 text-slate-900 hover:bg-slate-300`}
          >
            Sair
          </button>
        </>
      ) : (
        <>
          {error && <p className="text-sm text-red-700">Erro: {error.message}</p>}
          <div className="flex gap-3">
            <button
              onClick={login}
              className={`${buttonClass} bg-indigo-700 text-white hover:bg-indigo-800`}
            >
              Entrar
            </button>
            <button
              onClick={signup}
              className={`${buttonClass} border border-indigo-700 text-indigo-700 hover:bg-indigo-50`}
            >
              Criar conta
            </button>
          </div>
        </>
      )}
    </section>
  )
}
