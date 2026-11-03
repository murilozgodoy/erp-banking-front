import { isAxiosError } from 'axios'
import { CheckCircle2, Lock, UserPlus, UsersRound, X } from 'lucide-react'
import { useState } from 'react'

import { errorMessage } from '@/lib/errors'

import { useMembro } from '../../team/useMembro'
import type { TeamMember } from '../../types'
import { ButtonLink } from '../../ui/Button'
import { GatedButton } from '../../ui/Gated'
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '../../ui/Surface'
import { MemberSheet, type AccessAction, type SheetTarget } from './MemberSheet'
import { MemberTable } from './MemberTable'
import { useTeam } from './queries'

const DESCRIPTION = 'Quem acessa o portal da empresa e o que cada pessoa pode fazer.'

function isSemPermissao(error: unknown) {
  return (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    (error.response.data as { error?: string } | undefined)?.error === 'SEM_PERMISSAO'
  )
}

/** Equipe da empresa (seção 11): convidar, editar, suspender e remover pessoas. */
export function TeamPage() {
  const { membro, pode } = useMembro()
  const allowed = pode('gerenciar_equipe')
  const team = useTeam(allowed)
  const [sheet, setSheet] = useState<{ open: boolean; target: SheetTarget; key: number }>({
    open: false,
    target: { mode: 'invite' },
    key: 0,
  })
  const [notice, setNotice] = useState<string | null>(null)

  const openSheet = (target: SheetTarget) => {
    setNotice(null)
    setSheet((current) => ({ open: true, target, key: current.key + 1 }))
  }
  const closeSheet = () => setSheet((current) => ({ ...current, open: false }))
  const invite = () => openSheet({ mode: 'invite' })
  const edit = (member: TeamMember, intent?: AccessAction) =>
    openSheet({ mode: 'edit', member, intent })

  if (!allowed || (team.isError && isSemPermissao(team.error))) {
    return (
      <>
        <PageHeader title="Equipe" description={DESCRIPTION} />
        <Panel>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="Esta área é de quem gerencia a equipe"
          >
            Para convidar pessoas e definir o que cada uma pode fazer, é preciso a permissão de
            gerenciar a equipe. Peça a um administrador ou ao dono da empresa.
          </EmptyState>
          <div className="-mt-4 flex justify-center pb-4">
            <ButtonLink to="/app">Voltar para a visão geral</ButtonLink>
          </div>
        </Panel>
      </>
    )
  }

  const members = team.data ?? []
  const pendentes = members.filter((m) => m.status === 'CONVIDADO').length
  const soDono = team.isSuccess && members.every((m) => m.papel === 'DONO')

  return (
    <>
      <PageHeader
        title="Equipe"
        description={DESCRIPTION}
        actions={
          <GatedButton
            permissao="gerenciar_equipe"
            icon={<UserPlus className="size-4" />}
            onClick={invite}
          >
            Convidar pessoa
          </GatedButton>
        }
      />

      <div role="status" className="empty:hidden">
        {notice && (
          <p className="mb-4 flex items-center gap-2.5 rounded-control bg-positive-soft px-3.5 py-2.5 text-sm text-ink">
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-positive" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dispensar aviso"
              className="grid size-7 place-items-center rounded-control text-ink-muted hover:bg-surface hover:text-ink pointer-coarse:size-11"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </p>
        )}
      </div>

      {team.isPending ? (
        <TeamSkeleton />
      ) : team.isError ? (
        <ErrorState
          title="Não conseguimos carregar a equipe"
          message={`${errorMessage(team.error)} Verifique a conexão e tente de novo.`}
          onRetry={() => void team.refetch()}
        />
      ) : (
        <Panel
          id="equipe-pessoas"
          title="Pessoas"
          description={
            <span className="tabular">
              {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}
              {pendentes > 0 &&
                ` · ${pendentes} ${pendentes === 1 ? 'convite pendente' : 'convites pendentes'}`}
            </span>
          }
          flush
        >
          <MemberTable members={members} selfId={membro?.id ?? null} onEdit={edit} />
          {soDono && (
            <div className="border-t border-line">
              <EmptyState
                icon={<UsersRound className="size-5" />}
                title="Por enquanto, só você acessa o portal"
                action={
                  <GatedButton
                    permissao="gerenciar_equipe"
                    variant="secondary"
                    icon={<UserPlus className="size-4" />}
                    onClick={invite}
                  >
                    Convidar a primeira pessoa
                  </GatedButton>
                }
              >
                Convide quem cuida do financeiro, das compras ou o seu contador. Cada pessoa entra
                com o próprio login e só faz o que você permitir; pagamentos acima do limite dela
                esperam a sua aprovação.
              </EmptyState>
            </div>
          )}
        </Panel>
      )}

      <MemberSheet
        key={sheet.key}
        open={sheet.open}
        target={sheet.target}
        onClose={closeSheet}
        grantable={pode}
        onDone={(message) => {
          closeSheet()
          setNotice(message)
        }}
      />
    </>
  )
}

function TeamSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando a equipe…"
      className="rounded-panel border border-line bg-surface shadow-raised"
    >
      <div className="px-5 pt-4 pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-40" />
      </div>
      <div className="divide-y divide-line border-t border-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
