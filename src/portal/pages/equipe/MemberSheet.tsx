import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Check, Copy, Lock, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { fullDate, money } from '../../lib/format'
import { PAPEIS, PERMISSAO_INFO, PERMISSOES } from '../../team/permissions'
import type { InviteResponse, Papel, Permissao, TeamMember } from '../../types'
import { Button } from '../../ui/Button'
import { MoneyField, TextField } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import {
  applyPreset,
  emptyForm,
  FIELD_ORDER,
  formFromMember,
  limiteObrigatorio,
  localDay,
  PAPEIS_OFERECIDOS,
  papelBloqueado,
  semLimitePermitido,
  teamFailure,
  toInvite,
  toPatch,
  validate,
  type FormErrors,
  type MemberForm,
} from './model'
import { PermissaoLabel } from './PermissaoLabel'
import { useTeamMutations } from './queries'

export type AccessAction = 'suspend' | 'reactivate' | 'remove'

export type SheetTarget =
  { mode: 'invite' } | { mode: 'edit'; member: TeamMember; intent?: AccessAction }

interface MemberSheetProps {
  open: boolean
  target: SheetTarget
  onClose: () => void
  /** Pode conceder esta permissão (DONO concede tudo; os demais, só o que têm). */
  grantable: (permissao: Permissao) => boolean
  /** Mensagem para o anúncio da página depois de editar, suspender ou remover. */
  onDone: (message: string) => void
}

/** Convidar ou editar alguém da equipe, num painel lateral. */
export function MemberSheet({ open, target, onClose, grantable, onDone }: MemberSheetProps) {
  const member = target.mode === 'edit' ? target.member : null
  const [form, setForm] = useState<MemberForm>(() =>
    member ? formFromMember(member) : emptyForm(),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<InviteResponse | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ field: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const formId = useId()
  const { invite, update } = useTeamMutations()
  const pending = invite.isPending || update.isPending

  // Foco no primeiro campo com erro, na ordem da tela (só ao enviar, não a cada tecla).
  useEffect(() => {
    if (!focusRequest) return
    formRef.current?.querySelector<HTMLElement>(`[data-field="${focusRequest.field}"]`)?.focus()
  }, [focusRequest])

  const focusFirst = (found: FormErrors) => {
    const field = FIELD_ORDER.find((f) => found[f])
    if (field) setFocusRequest({ field })
  }

  const set = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    const field = key === 'semLimite' ? 'limite' : key
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const choosePapel = (papel: Exclude<Papel, 'DONO'>) => {
    setForm((current) => applyPreset(current, papel, grantable))
    setErrors((current) => ({
      ...current,
      papel: undefined,
      permissoes: undefined,
      limite: undefined,
    }))
  }

  const togglePermissao = (permissao: Permissao) => {
    setForm((current) => {
      const on = current.permissoes.includes(permissao)
      const permissoes = PERMISSOES.filter((p) =>
        p === permissao ? !on : current.permissoes.includes(p),
      )
      return { ...current, permissoes }
    })
    setErrors((current) => ({ ...current, permissoes: undefined, limite: undefined }))
  }

  const fail = (error: unknown) => {
    const result = teamFailure(error)
    setErrors(result.fields)
    setFailure(result.message)
    focusFirst(result.fields)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFailure(null)
    const found = validate(form, target.mode)
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirst(found)
      return
    }
    if (member) {
      update.mutate(
        { id: member.id, patch: toPatch(form) },
        {
          onSuccess: (saved) => onDone(`Acesso de ${saved.nome} atualizado.`),
          onError: fail,
        },
      )
    } else {
      invite.mutate(toInvite(form), { onSuccess: setCreated, onError: fail })
    }
  }

  const again = () => {
    setCreated(null)
    setForm(emptyForm())
    setErrors({})
    setFailure(null)
    invite.reset()
  }

  const title = created ? 'Convite criado' : member ? member.nome : 'Convidar pessoa'
  const description = created
    ? undefined
    : member
      ? member.email
      : 'A pessoa recebe um link para entrar na equipe com o acesso que você definir.'

  const footer = created ? (
    <>
      <Button variant="secondary" onClick={again}>
        Convidar outra pessoa
      </Button>
      <Button onClick={onClose}>Concluir</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={formId} loading={pending}>
        {member ? 'Salvar alterações' : 'Criar convite'}
      </Button>
    </>
  )

  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} footer={footer}>
      {created ? (
        <InviteCreated result={created} />
      ) : (
        <form ref={formRef} id={formId} noValidate onSubmit={submit} className="space-y-7">
          {failure && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-control bg-negative-soft px-3 py-2.5 text-sm text-ink"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />
              {failure}
            </p>
          )}

          {!member && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nome"
                required
                autoComplete="off"
                data-field="nome"
                value={form.nome}
                error={errors.nome}
                onChange={(event) => set('nome', event.currentTarget.value)}
              />
              <TextField
                label="E-mail"
                required
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                data-field="email"
                value={form.email}
                error={errors.email}
                hint="O que a pessoa usa para entrar."
                onChange={(event) => set('email', event.currentTarget.value)}
              />
            </div>
          )}

          <RoleCards
            value={form.papel}
            error={errors.papel}
            grantable={grantable}
            onChange={choosePapel}
            changedFrom={member && member.papel !== form.papel ? member.papel : null}
          />

          {form.papel && (
            <PermissionToggles
              value={form.permissoes}
              error={errors.permissoes}
              grantable={grantable}
              onToggle={togglePermissao}
            />
          )}

          {form.papel && <LimitField form={form} error={errors.limite} set={set} />}
        </form>
      )}
      {member && !created && (
        <AccessZone
          key={target.mode === 'edit' ? target.intent : undefined}
          member={member}
          intent={target.mode === 'edit' ? target.intent : undefined}
          onDone={onDone}
        />
      )}
    </Sheet>
  )
}

// ---------- papel ----------

function RoleCards({
  value,
  error,
  grantable,
  onChange,
  changedFrom,
}: {
  value: MemberForm['papel']
  error?: string
  grantable: (p: Permissao) => boolean
  onChange: (papel: Exclude<Papel, 'DONO'>) => void
  changedFrom: Papel | null
}) {
  const errorId = useId()
  const name = useId()
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-medium text-ink">
        Papel
        <span className="text-ink-muted" aria-hidden>
          {' '}
          *
        </span>
      </legend>
      <p className="mt-0.5 text-xs text-ink-muted">
        O papel liga as permissões padrão. Você ajusta uma a uma logo abaixo.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PAPEIS_OFERECIDOS.map((papel, index) => {
          const locked = papelBloqueado(papel, grantable)
          const checked = value === papel
          return (
            <label
              key={papel}
              className={cn(
                'relative flex cursor-pointer flex-col gap-0.5 rounded-control border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-150',
                'has-focus-visible:ring-3 has-focus-visible:ring-accent/25',
                checked
                  ? 'border-accent bg-accent-soft/50'
                  : 'border-line-strong bg-surface hover:border-ink-faint',
                locked && 'cursor-not-allowed border-line bg-sunken hover:border-line',
                error && !checked && 'border-negative/60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={papel}
                checked={checked}
                disabled={locked}
                aria-describedby={error ? errorId : undefined}
                data-field={index === 0 ? 'papel' : undefined}
                onChange={() => onChange(papel)}
                className="peer sr-only"
              />
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                {PAPEIS[papel].label}
                {checked && (
                  <span className="grid size-4 place-items-center rounded-full bg-accent text-on-accent">
                    <Check aria-hidden className="size-3" strokeWidth={3} />
                  </span>
                )}
                {locked && <Lock aria-hidden className="size-3.5 text-ink-faint" />}
              </span>
              <span className="text-xs text-ink-muted">
                {locked ? 'Inclui permissões que você não tem.' : PAPEIS[papel].descricao}
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-negative">
          {error}
        </p>
      )}
      {changedFrom && value && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
          <RotateCcw aria-hidden className="mt-px size-3.5 shrink-0" />
          Era {PAPEIS[changedFrom].label}. As permissões voltaram ao padrão de {PAPEIS[value].label}
          ; ajuste abaixo se precisar.
        </p>
      )}
    </fieldset>
  )
}

// ---------- permissões ----------

function PermissionToggles({
  value,
  error,
  grantable,
  onToggle,
}: {
  value: Permissao[]
  error?: string
  grantable: (p: Permissao) => boolean
  onToggle: (permissao: Permissao) => void
}) {
  const id = useId()
  const firstEnabled = PERMISSOES.find(grantable)
  const anyLocked = PERMISSOES.some((p) => !grantable(p))
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${id}-title`} className="text-sm font-medium text-ink">
          Permissões
        </h3>
        <span className="tabular text-xs text-ink-muted">
          {value.length} de {PERMISSOES.length}
        </span>
      </div>
      {anyLocked && (
        <p className="mt-0.5 text-xs text-ink-muted">
          Você só concede o que também pode fazer. As demais ficam travadas.
        </p>
      )}
      <ul className="mt-2 divide-y divide-line rounded-control border border-line">
        {PERMISSOES.map((permissao) => {
          const info = PERMISSAO_INFO[permissao]
          const on = value.includes(permissao)
          const locked = !grantable(permissao)
          return (
            <li key={permissao} className="flex items-center gap-4 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p id={`${id}-${permissao}`} className="text-sm font-medium text-ink">
                  <PermissaoLabel permissao={permissao} />
                </p>
                <p id={`${id}-${permissao}-desc`} className="text-xs text-ink-muted">
                  {locked ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock aria-hidden className="size-3" />
                      Você não tem esta permissão para concedê-la.
                    </span>
                  ) : (
                    info.descricao
                  )}
                </p>
              </div>
              <Switch
                on={on}
                disabled={locked}
                labelledBy={`${id}-${permissao}`}
                describedBy={cn(`${id}-${permissao}-desc`, error && `${id}-error`)}
                dataField={permissao === firstEnabled ? 'permissoes' : undefined}
                onToggle={() => onToggle(permissao)}
              />
            </li>
          )
        })}
      </ul>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </section>
  )
}

function Switch({
  on,
  disabled,
  labelledBy,
  describedBy,
  dataField,
  onToggle,
}: {
  on: boolean
  disabled: boolean
  labelledBy: string
  describedBy: string
  dataField?: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      data-field={dataField}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
        'pointer-coarse:after:absolute pointer-coarse:after:-inset-3',
        on ? 'bg-accent' : 'bg-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-4 rounded-full bg-surface shadow-sm transition-transform duration-150 ease-out',
          on ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

// ---------- limite ----------

function LimitField({
  form,
  error,
  set,
}: {
  form: MemberForm
  error?: string
  set: <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => void
}) {
  const id = useId()
  const pagar = form.permissoes.includes('pagar')
  const podeSemLimite = semLimitePermitido(form.papel)
  const hint = 'Acima do limite, o pagamento fica aguardando aprovação de quem pode aprovar.'
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <h3 id={`${id}-title`} className="text-sm font-medium text-ink">
        Limite de pagamento
      </h3>
      {!pagar ? (
        <p className="text-sm text-ink-muted">Sem a permissão de pagar, não há limite a definir.</p>
      ) : (
        <>
          {podeSemLimite && (
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.semLimite}
                onChange={(event) => {
                  set('semLimite', event.currentTarget.checked)
                  if (event.currentTarget.checked) set('limite', null)
                }}
                className="size-4 accent-[var(--erpia-accent)]"
              />
              Sem limite
            </label>
          )}
          {!(podeSemLimite && form.semLimite) ? (
            <MoneyField
              label="Paga sem aprovação até"
              required={limiteObrigatorio(form)}
              data-field="limite"
              value={form.limite}
              onValueChange={(value) => set('limite', value)}
              error={error}
              hint={hint}
              className="max-w-64"
            />
          ) : (
            <p className="text-xs text-ink-muted">
              {PAPEIS[form.papel!].label} paga qualquer valor sem precisar de aprovação.
            </p>
          )}
        </>
      )}
    </section>
  )
}

// ---------- convite criado ----------

function InviteCreated({ result }: { result: InviteResponse }) {
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()
  const { membro, convite_url } = result
  const expira = membro.convite_expira_em ? fullDate(localDay(membro.convite_expira_em)) : null

  // O painel troca de conteúdo sem reabrir: o foco vai ao link.
  useEffect(() => {
    input.current?.focus()
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(convite_url)
    } catch {
      // Sem a API (http, permissão negada): seleciona para o Ctrl+C.
      input.current?.select()
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
          <Check aria-hidden className="size-4.5" strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-base font-semibold text-ink">
            {membro.nome} pode entrar como {PAPEIS[membro.papel].label}
          </p>
          <p className="text-sm text-ink-muted">
            Envie o link pelo canal que vocês já usam.{' '}
            {expira ? `Ele vale até ${expira}.` : 'Ele vale por 7 dias.'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="convite-url" className="text-sm font-medium text-ink">
          Link do convite
        </label>
        <div className="flex gap-2">
          <input
            ref={input}
            id="convite-url"
            readOnly
            value={convite_url}
            data-autofocus
            onFocus={(event) => event.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-control border border-line-strong bg-sunken px-3 text-sm text-ink outline-none focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
          <Button
            variant="secondary"
            onClick={() => void copy()}
            icon={copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p role="status" className="h-4 text-xs text-positive">
          <AnimatePresence>
            {copied && (
              <motion.span
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
              >
                Link copiado
              </motion.span>
            )}
          </AnimatePresence>
        </p>
      </div>

      <p className="flex items-start gap-2.5 rounded-control bg-warning-soft px-3.5 py-3 text-sm text-ink">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold">Guarde agora: o link não aparece de novo.</strong> Se
          perder, revogue este convite e crie outro.
        </span>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
        <dt className="text-ink-muted">E-mail</dt>
        <dd className="min-w-0 truncate text-ink">{membro.email}</dd>
        <dt className="text-ink-muted">Permissões</dt>
        <dd className="text-ink">
          {membro.permissoes.map((p, i) => (
            <span key={p}>
              {i > 0 && ', '}
              <PermissaoLabel permissao={p} />
            </span>
          ))}
        </dd>
        <dt className="text-ink-muted">Limite</dt>
        <dd className="tabular text-ink">
          {!membro.permissoes.includes('pagar')
            ? 'Não paga'
            : membro.limite_pagamento === null
              ? 'Sem limite'
              : money(membro.limite_pagamento)}
        </dd>
      </dl>
    </div>
  )
}

// ---------- suspender, reativar, remover ----------

const ACCESS_COPY: Record<
  AccessAction | 'revoke',
  {
    button: string
    question: (nome: string) => string
    detail: string
    confirm: string
    done: (nome: string) => string
  }
> = {
  suspend: {
    button: 'Suspender acesso',
    question: (nome) => `Suspender o acesso de ${nome}?`,
    detail:
      'A pessoa deixa de entrar no portal na hora. Você pode reativar depois, com o mesmo acesso.',
    confirm: 'Suspender',
    done: (nome) => `Acesso de ${nome} suspenso.`,
  },
  reactivate: {
    button: 'Reativar acesso',
    question: (nome) => `Reativar o acesso de ${nome}?`,
    detail: 'A pessoa volta a entrar no portal com as mesmas permissões de antes.',
    confirm: 'Reativar',
    done: (nome) => `Acesso de ${nome} reativado.`,
  },
  remove: {
    button: 'Remover da equipe',
    question: (nome) => `Remover ${nome} da equipe?`,
    detail: 'A pessoa perde o acesso de vez. Para voltar, precisa de um novo convite.',
    confirm: 'Remover',
    done: (nome) => `${nome} saiu da equipe.`,
  },
  revoke: {
    button: 'Revogar convite',
    question: () => 'Revogar este convite?',
    detail: 'O link para de funcionar na hora. Você pode convidar a mesma pessoa de novo.',
    confirm: 'Revogar convite',
    done: (nome) => `O convite de ${nome} foi revogado.`,
  },
}

function AccessZone({
  member,
  intent,
  onDone,
}: {
  member: TeamMember
  intent?: AccessAction
  onDone: (message: string) => void
}) {
  const convidado = member.status === 'CONVIDADO'
  const toKey = (action: AccessAction) =>
    action === 'remove' && convidado ? ('revoke' as const) : action
  const [asking, setAsking] = useState<AccessAction | null>(intent ?? null)
  const [failure, setFailure] = useState<string | null>(null)
  const { update, remove } = useTeamMutations()
  const reduce = useReducedMotion()
  const actions: AccessAction[] = convidado
    ? ['remove']
    : member.status === 'SUSPENSO'
      ? ['reactivate', 'remove']
      : ['suspend', 'remove']

  const run = (action: AccessAction) => {
    setFailure(null)
    const copy = ACCESS_COPY[toKey(action)]
    const onError = (error: unknown) => setFailure(teamFailure(error).message)
    const onSuccess = () => onDone(copy.done(member.nome))
    if (action === 'remove') remove.mutate(member.id, { onSuccess, onError })
    else
      update.mutate(
        { id: member.id, patch: { status: action === 'suspend' ? 'SUSPENSO' : 'ATIVO' } },
        { onSuccess, onError },
      )
  }

  return (
    <section aria-labelledby="acesso-title" className="mt-8 border-t border-line pt-5">
      <h3 id="acesso-title" className="text-sm font-medium text-ink">
        Acesso
      </h3>
      <AnimatePresence mode="wait" initial={false}>
        {asking ? (
          <motion.div
            key="confirm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="mt-3 rounded-control border border-line bg-sunken p-4"
          >
            <p className="text-sm font-semibold text-ink">
              {ACCESS_COPY[toKey(asking)].question(member.nome)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{ACCESS_COPY[toKey(asking)].detail}</p>
            {failure && (
              <p role="alert" className="mt-2 text-sm font-medium text-negative">
                {failure}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={asking === 'reactivate' ? 'primary' : 'danger'}
                loading={update.isPending || remove.isPending}
                data-autofocus
                onClick={() => run(asking)}
              >
                {ACCESS_COPY[toKey(asking)].confirm}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                Voltar
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="mt-3 flex flex-wrap gap-2"
          >
            {actions.map((action) => (
              <AccessButton
                key={action}
                danger={action !== 'reactivate'}
                onClick={() => setAsking(action)}
              >
                {ACCESS_COPY[toKey(action)].button}
              </AccessButton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function AccessButton({
  danger,
  onClick,
  children,
}: {
  danger: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={onClick}
      className={cn(danger && 'text-negative hover:border-negative/50 hover:bg-negative-soft')}
    >
      {children}
    </Button>
  )
}
