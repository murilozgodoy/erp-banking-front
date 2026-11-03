import { Ban, Crown, Pencil, RotateCcw, Trash2, UserX } from 'lucide-react'
import { useId, useState } from 'react'

import { cn } from '@/lib/cn'

import { PAPEIS, PERMISSAO_INFO, PERMISSOES } from '../../team/permissions'
import type { TeamMember } from '../../types'
import { DataTable, type Column } from '../../ui/DataTable'
import { Money } from '../../ui/Money'
import { Pill } from '../../ui/Pill'
import type { AccessAction } from './MemberSheet'
import { initials, statusView } from './model'
import { PermissaoLabel } from './PermissaoLabel'
import { RowMenu, type MenuAction } from './RowMenu'

const VISIBLE_CHIPS = 3

interface MemberTableProps {
  members: TeamMember[]
  /** `id` de quem está logado: a própria linha não tem ações. */
  selfId: number | null
  onEdit: (member: TeamMember, intent?: AccessAction) => void
}

/** A equipe em tabela densa: pessoa, papel, status, permissões, limite e ações. */
export function MemberTable({ members, selfId, onEdit }: MemberTableProps) {
  const columns: Column<TeamMember>[] = [
    {
      key: 'pessoa',
      header: 'Pessoa',
      cell: (m) => <Person member={m} self={m.id === selfId} />,
      className: 'sm:min-w-56',
    },
    {
      key: 'papel',
      header: 'Papel',
      hideBelow: 'sm',
      cell: (m) => (
        <Pill tone={m.papel === 'DONO' ? 'accent' : 'neutral'} dot={false}>
          {m.papel === 'DONO' && <Crown aria-hidden className="size-3" />}
          {PAPEIS[m.papel].label}
        </Pill>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'sm',
      cell: (m) => {
        const view = statusView(m)
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Pill tone={view.tone}>{view.label}</Pill>
            {view.detail && (
              <span className="pl-1 text-xs whitespace-nowrap text-ink-muted">{view.detail}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'permissoes',
      header: 'Permissões',
      hideBelow: 'lg',
      cell: (m) => <PermissionChips member={m} />,
      className: 'max-w-80',
    },
    {
      key: 'limite',
      header: 'Limite de pagamento',
      align: 'right',
      hideBelow: 'md',
      cell: (m) => <Limit member={m} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      cell: (m) => <Actions member={m} self={m.id === selfId} onEdit={onEdit} />,
      className: 'w-12',
    },
  ]
  return (
    <DataTable
      caption="Pessoas da equipe, com papel, status, permissões e limite de pagamento"
      columns={columns}
      rows={members}
      rowKey={(m) => m.id}
      rowClassName={(m) => (m.status === 'SUSPENSO' ? '[&_td]:text-ink-muted' : undefined)}
    />
  )
}

function Person({ member, self }: { member: TeamMember; self: boolean }) {
  const dono = member.papel === 'DONO'
  const view = statusView(member)
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold tracking-wide',
          dono ? 'bg-accent text-on-accent' : 'bg-sunken text-ink-muted',
          member.status === 'CONVIDADO' && 'border border-dashed border-line-strong bg-surface',
        )}
      >
        {initials(member.nome)}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              'truncate font-medium',
              member.status === 'SUSPENSO' ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {member.nome}
          </span>
          {self && (
            <span className="rounded-full border border-line-strong px-1.5 text-2xs leading-4 font-medium text-ink-muted">
              você
            </span>
          )}
        </p>
        <p className="text-xs [overflow-wrap:anywhere] text-ink-muted">{member.email}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted sm:hidden">
          {PAPEIS[member.papel].label}
          <Pill tone={view.tone}>{view.detail ? `${view.label}, ${view.detail}` : view.label}</Pill>
        </p>
      </div>
    </div>
  )
}

function PermissionChips({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ordered = PERMISSOES.filter((p) => member.permissoes.includes(p))
  if (ordered.length === PERMISSOES.length) {
    return <span className="text-sm text-ink">Acesso total</span>
  }
  if (ordered.length === 0) return <span className="text-sm text-ink-muted">Nenhuma</span>
  const hidden = ordered.length - VISIBLE_CHIPS
  const shown = open ? ordered : ordered.slice(0, VISIBLE_CHIPS)
  return (
    <ul id={id} className="flex flex-wrap items-center gap-1" aria-label="Permissões">
      {shown.map((p) => (
        <li
          key={p}
          className="rounded-[5px] bg-sunken px-1.5 py-0.5 text-xs whitespace-nowrap text-ink-muted"
        >
          <PermissaoLabel permissao={p} />
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            aria-label={open ? 'Mostrar menos permissões' : `Mostrar mais ${hidden} permissões`}
            title={
              open
                ? undefined
                : ordered
                    .slice(VISIBLE_CHIPS)
                    .map((p) => PERMISSAO_INFO[p].label)
                    .join(', ')
            }
            onClick={() => setOpen((v) => !v)}
            className="tabular rounded-[5px] border border-line px-1.5 py-0.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink pointer-coarse:min-h-8"
          >
            {open ? 'menos' : `+${hidden}`}
          </button>
        </li>
      )}
    </ul>
  )
}

function Limit({ member }: { member: TeamMember }) {
  if (!member.permissoes.includes('pagar')) {
    return <span className="text-sm text-ink-faint">Não paga</span>
  }
  if (member.limite_pagamento === null) return <span className="text-sm">Sem limite</span>
  return <Money value={member.limite_pagamento} size="sm" />
}

function Actions({
  member,
  self,
  onEdit,
}: {
  member: TeamMember
  self: boolean
  onEdit: (member: TeamMember, intent?: AccessAction) => void
}) {
  if (member.papel === 'DONO' || self) {
    return (
      <span className="sr-only">
        {self ? 'Sem ações: você não altera o próprio acesso' : 'Sem ações: o dono não é editável'}
      </span>
    )
  }
  const actions: MenuAction[] = [
    { label: 'Editar acesso', icon: <Pencil />, onSelect: () => onEdit(member) },
  ]
  if (member.status === 'ATIVO') {
    actions.push({ label: 'Suspender', icon: <Ban />, onSelect: () => onEdit(member, 'suspend') })
  }
  if (member.status === 'SUSPENSO') {
    actions.push({
      label: 'Reativar',
      icon: <RotateCcw />,
      onSelect: () => onEdit(member, 'reactivate'),
    })
  }
  actions.push(
    member.status === 'CONVIDADO'
      ? {
          label: 'Revogar convite',
          icon: <UserX />,
          danger: true,
          onSelect: () => onEdit(member, 'remove'),
        }
      : {
          label: 'Remover da equipe',
          icon: <Trash2 />,
          danger: true,
          onSelect: () => onEdit(member, 'remove'),
        },
  )
  return <RowMenu label={`Ações para ${member.nome}`} actions={actions} />
}
