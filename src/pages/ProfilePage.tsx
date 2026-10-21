import { useAuth0 } from '@auth0/auth0-react'
import { useState } from 'react'

import { ALL_PERMISSIONS, PERMISSIONS } from '@/auth/permissions'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { usePermissions } from '@/hooks/usePermissions'
import { errorMessage } from '@/lib/errors'

export function ProfilePage() {
  const { user, getAccessTokenSilently } = useAuth0()
  const { permissions, isLoading, error, can } = usePermissions()
  const [copied, setCopied] = useState(false)

  // Só em desenvolvimento: facilita testar as APIs (Swagger, smoke test) com o próprio token.
  const copyToken = async () => {
    await navigator.clipboard.writeText((await getAccessTokenSilently()) ?? '')
    setCopied(true)
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Meu perfil" description="Dados da conta Auth0 e permissões no ERP" />

      <Card title="Conta">
        <div className="flex items-center gap-4">
          {user?.picture && <img src={user.picture} alt="" className="size-14 rounded-full" />}
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="sr-only">Nome</dt>
              <dd className="text-base font-semibold">{user?.name}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">E-mail</dt>
              <dd>{user?.email}</dd>
              {user?.email_verified === false && (
                <Badge tone="warning">e-mail não verificado</Badge>
              )}
            </div>
            <div>
              <dt className="sr-only">Identificador</dt>
              <dd className="font-mono text-xs text-slate-500">{user?.sub}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card
        title="Permissões"
        description={`${permissions.length} de ${ALL_PERMISSIONS.length} permissões concedidas pelo seu perfil`}
      >
        {isLoading && <Spinner label="Lendo permissões do token…" />}
        {error && <Alert tone="error">{errorMessage(error)}</Alert>}
        {!isLoading && !error && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((permission) => (
              <li key={permission} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {PERMISSIONS[permission]}{' '}
                  <code className="font-mono text-xs text-slate-500">{permission}</code>
                </span>
                {can(permission) ? (
                  <Badge tone="success">concedida</Badge>
                ) : (
                  <Badge>não concedida</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {import.meta.env.DEV && (
        <Card
          title="Desenvolvimento"
          description="Access token para chamar as APIs pelo Swagger ou pelo smoke test"
        >
          <Button variant="secondary" onClick={copyToken}>
            {copied ? 'Token copiado!' : 'Copiar access token'}
          </Button>
        </Card>
      )}
    </section>
  )
}
