import { useAuth0 } from '@auth0/auth0-react'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/cn'

import { useMe } from '../../layout/queries'
import { formatCnpj, money } from '../../lib/format'
import { PAPEIS, PERMISSAO_INFO, PERMISSOES } from '../../team/permissions'
import { useMembro } from '../../team/useMembro'
import { Pill } from '../../ui/Pill'
import { PermissaoLabel } from '../equipe/PermissaoLabel'
import { PageHeader, Panel, Skeleton } from '../../ui/Surface'

const STATUS = {
  ATIVO: { label: 'Ativo', tone: 'positive' },
  CONVIDADO: { label: 'Convidado', tone: 'info' },
  SUSPENSO: { label: 'Suspenso', tone: 'negative' },
} as const

/**
 * Perfil dentro do portal: quem é a pessoa, o papel na empresa e as permissões da equipe
 * (seção 11), não as permissões do Auth0.
 */
export function PortalProfilePage() {
  const { user } = useAuth0()
  const me = useMe()
  const { membro, pode } = useMembro()
  const empresa = me.data?.empresa
  const nome = membro?.nome ?? user?.name ?? 'Você'
  const email = membro?.email ?? user?.email
  // Sem membro (API antiga): acesso total, como dono.
  const papel = membro?.papel ?? 'DONO'

  return (
    <>
      <PageHeader
        title="Meu perfil"
        description="Sua conta, seu papel na empresa e o que você pode fazer no portal."
      />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel id="conta" title="Conta">
            <div className="flex items-center gap-4">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="size-14 rounded-full border border-line"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-14 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent"
                >
                  {nome.slice(0, 1).toUpperCase()}
                </span>
              )}
              <dl className="min-w-0 space-y-0.5">
                <dt className="sr-only">Nome</dt>
                <dd className="truncate text-base font-semibold text-ink">{nome}</dd>
                <dt className="sr-only">E-mail</dt>
                <dd className="truncate text-sm text-ink-muted">{email}</dd>
              </dl>
            </div>
          </Panel>

          <Panel id="empresa" title="Na empresa">
            {me.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-ink-muted">Empresa</dt>
                  <dd className="font-medium text-ink">
                    {empresa?.nome_fantasia ?? '—'}
                    {empresa?.cnpj && (
                      <span className="tabular ml-2 text-ink-muted">
                        {formatCnpj(empresa.cnpj)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Papel</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Pill tone="accent" dot={false}>
                      {PAPEIS[papel].label}
                    </Pill>
                    {membro && (
                      <Pill tone={STATUS[membro.status].tone}>{STATUS[membro.status].label}</Pill>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Limite por pagamento</dt>
                  <dd className="tabular mt-0.5 font-medium text-ink">
                    {membro?.limite_pagamento != null
                      ? money(membro.limite_pagamento)
                      : 'Sem limite'}
                  </dd>
                </div>
                <p className="col-span-2 text-xs text-ink-muted">{PAPEIS[papel].descricao}</p>
              </dl>
            )}
          </Panel>
        </div>

        <Panel
          id="permissoes"
          title="O que você pode fazer"
          description="Definido por quem administra a equipe da empresa. Para mudar, fale com essa pessoa."
          flush
        >
          <ul className="grid border-t border-line sm:grid-cols-2">
            {PERMISSOES.map((permissao) => {
              const ok = pode(permissao)
              return (
                <li
                  key={permissao}
                  className="-mt-px -ml-px flex items-start gap-3 border-t border-l border-line px-5 py-3"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                      ok ? 'bg-positive-soft text-positive' : 'bg-sunken text-ink-faint',
                    )}
                  >
                    {ok ? (
                      <Check aria-hidden className="size-3.5" />
                    ) : (
                      <Minus aria-hidden className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', ok ? 'text-ink' : 'text-ink-muted')}>
                      <PermissaoLabel permissao={permissao} />
                      <span className="sr-only">{ok ? ': permitido' : ': sem permissão'}</span>
                    </p>
                    <p className="text-xs text-ink-muted">{PERMISSAO_INFO[permissao].descricao}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </>
  )
}
