import { useAuth0 } from '@auth0/auth0-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { motion, useReducedMotion } from 'motion/react'
import {
  CircleCheck,
  Clock3,
  Link2Off,
  LogIn,
  RotateCw,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ErpIaLogo, Marca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'
import { usePortalApi } from '@/portal/api'
import { portalKeys } from '@/portal/layout/queries'
import { Button, ButtonLink } from '@/portal/ui/Button'
import { Skeleton } from '@/portal/ui/Surface'

/** Tempo para ler a confirmação antes de abrir o portal. */
export const REDIRECT_MS = 1200

type Failure =
  | { kind: 'expirado' }
  | { kind: 'vinculado' }
  | { kind: 'nao-encontrado' }
  | { kind: 'outro'; message: string }

function failureOf(error: unknown): Failure {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const code = (error.response?.data as { error?: string } | undefined)?.error
    if (status === 410 || code === 'CONVITE_EXPIRADO') return { kind: 'expirado' }
    if (code === 'JA_VINCULADO') return { kind: 'vinculado' }
    if (status === 404) return { kind: 'nao-encontrado' }
  }
  return { kind: 'outro', message: errorMessage(error) }
}

/**
 * Aceite do convite de equipe (`/convite/:token`, seção 11), fora do portal: sem login, explica
 * o convite e leva ao Auth0 (entrar ou criar conta) voltando para cá; com login, aceita uma vez
 * e abre o portal da empresa.
 */
export function InvitePage() {
  const { token = '' } = useParams()
  const { isLoading, isAuthenticated } = useAuth0()

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link to="/" aria-label="ErpIa, página inicial" className="rounded-control">
            <ErpIaLogo />
          </Link>
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-12 outline-none sm:items-center sm:py-16"
      >
        <div className="w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-raised sm:p-8">
          {isLoading ? (
            <Loading label="Verificando sua sessão…" />
          ) : isAuthenticated ? (
            <Accept token={token} />
          ) : (
            <SignIn token={token} />
          )}
        </div>
      </main>
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="size-11 rounded-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
      <p className="pt-1 text-sm text-ink-muted">{label}</p>
    </div>
  )
}

function Message({
  icon: Icon,
  tone = 'neutral',
  title,
  children,
  actions,
}: {
  icon: LucideIcon
  tone?: 'neutral' | 'positive' | 'warning' | 'negative'
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  const reduce = useReducedMotion()
  const heading = useRef<HTMLHeadingElement>(null)
  // A troca de estado (carregando → resultado) é anunciada levando o foco ao título.
  useEffect(() => heading.current?.focus(), [])
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <span
        className={cn(
          'grid size-11 place-items-center rounded-full',
          tone === 'positive' && 'bg-positive-soft text-positive',
          tone === 'warning' && 'bg-warning-soft text-warning',
          tone === 'negative' && 'bg-negative-soft text-negative',
          tone === 'neutral' && 'bg-accent-soft text-accent',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-5 text-xl font-semibold tracking-[-0.01em] text-ink outline-none"
      >
        {title}
      </h1>
      <div className="mt-2 space-y-2 text-sm text-ink-muted">{children}</div>
      {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  )
}

function SignIn({ token }: { token: string }) {
  const { loginWithRedirect } = useAuth0()
  const returnTo = `/convite/${token}`
  return (
    <Message
      icon={UsersRound}
      title={
        <>
          Você foi convidado para a equipe de uma empresa na <Marca />
        </>
      }
      actions={
        <>
          <Button
            icon={<LogIn className="size-4" />}
            onClick={() => void loginWithRedirect({ appState: { returnTo } })}
          >
            Entrar
          </Button>
          <Button
            variant="secondary"
            icon={<UserPlus className="size-4" />}
            onClick={() =>
              void loginWithRedirect({
                appState: { returnTo },
                authorizationParams: { screen_hint: 'signup' },
              })
            }
          >
            Criar conta
          </Button>
        </>
      }
    >
      <p>
        Entre com a sua conta, ou crie uma com o e-mail que recebeu o convite. Logo depois você abre
        o portal da empresa, com o acesso que ela definiu para você.
      </p>
      <p className="text-xs text-ink-faint">O convite vale por 7 dias a partir do envio.</p>
    </Message>
  )
}

function Accept({ token }: { token: string }) {
  const api = usePortalApi()
  const { logout } = useAuth0()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const started = useRef(false)
  const [redirecting, setRedirecting] = useState(false)
  const accept = useMutation({
    mutationFn: () => api.onboarding.acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: portalKeys.me })
      setRedirecting(true)
    },
  })

  // Aceita uma vez só (o StrictMode monta os efeitos duas vezes em dev).
  useEffect(() => {
    if (started.current) return
    started.current = true
    accept.mutate()
  }, [accept])

  useEffect(() => {
    if (!redirecting) return
    const timer = window.setTimeout(() => navigate('/app', { replace: true }), REDIRECT_MS)
    return () => window.clearTimeout(timer)
  }, [redirecting, navigate])

  if (accept.isSuccess) {
    return (
      <Message
        icon={CircleCheck}
        tone="positive"
        title="Pronto, você entrou na equipe"
        actions={
          <ButtonLink to="/app" variant="primary" replace>
            Abrir o portal
          </ButtonLink>
        }
      >
        <p role="status">Abrindo o portal da empresa…</p>
      </Message>
    )
  }

  if (accept.isError) {
    const failure = failureOf(accept.error)
    const home = (
      <ButtonLink to="/" variant="secondary">
        Ir para o início
      </ButtonLink>
    )
    if (failure.kind === 'expirado') {
      return (
        <Message icon={Clock3} tone="warning" title="Este convite expirou" actions={home}>
          <p>
            Convites valem 7 dias. Peça a quem convidou você um link novo; este não funciona mais.
          </p>
        </Message>
      )
    }
    if (failure.kind === 'vinculado') {
      return (
        <Message
          icon={UsersRound}
          tone="warning"
          title="Esta conta já pertence a outra empresa"
          actions={
            <>
              <Button
                icon={<LogIn className="size-4" />}
                onClick={() =>
                  void logout({
                    logoutParams: { returnTo: `${window.location.origin}/convite/${token}` },
                  })
                }
              >
                Entrar com outra conta
              </Button>
              <ButtonLink to="/app" variant="secondary">
                Ir para o meu portal
              </ButtonLink>
            </>
          }
        >
          <p>
            Cada login acessa uma empresa só. Saia e entre com o e-mail que recebeu o convite, ou
            peça a quem convidou um convite para outro e-mail.
          </p>
        </Message>
      )
    }
    if (failure.kind === 'nao-encontrado') {
      return (
        <Message icon={Link2Off} tone="warning" title="Convite não encontrado" actions={home}>
          <p>
            O link pode estar incompleto ou o convite foi revogado. Confira se copiou o endereço
            inteiro ou peça um novo a quem convidou você.
          </p>
        </Message>
      )
    }
    return (
      <Message
        icon={RotateCw}
        tone="negative"
        title="Não conseguimos aceitar o convite"
        actions={
          <>
            <Button icon={<RotateCw className="size-4" />} onClick={() => accept.mutate()}>
              Tentar de novo
            </Button>
            {home}
          </>
        }
      >
        <p>{failure.message}</p>
      </Message>
    )
  }

  return <Loading label="Entrando na equipe…" />
}
