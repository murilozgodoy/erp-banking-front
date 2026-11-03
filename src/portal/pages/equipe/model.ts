import { isAxiosError } from 'axios'

import { errorMessage } from '@/lib/errors'

import { daysFromToday, isoDay, money } from '../../lib/format'
import { PAPEIS, PERMISSAO_INFO, PERMISSOES, semPermissaoTexto } from '../../team/permissions'
import type {
  InviteRequest,
  MembroStatus,
  Papel,
  Permissao,
  TeamMember,
  TeamMemberPatch,
} from '../../types'
import type { Tone } from '../../ui/Pill'

/** Papéis oferecidos no convite e na edição: sem DONO (não há promoção nem troca na v1). */
export const PAPEIS_OFERECIDOS: Exclude<Papel, 'DONO'>[] = [
  'ADMIN',
  'FINANCEIRO',
  'OPERADOR',
  'LEITURA',
]

/** Só DONO e ADMIN podem pagar sem limite. */
export function semLimitePermitido(papel: Papel | null): boolean {
  return papel === 'DONO' || papel === 'ADMIN'
}

/** Quem está convidando/editando: papel e o próprio limite (`null` = sem limite). */
export interface Ator {
  papel: Papel
  limite: number | null
}

/** Acesso total (membro ausente na API antiga conta como DONO). */
export const ATOR_DONO: Ator = { papel: 'DONO', limite: null }

/** DONO > ADMIN > FINANCEIRO > OPERADOR > LEITURA. */
const NIVEL: Record<Papel, number> = { DONO: 0, ADMIN: 1, FINANCEIRO: 2, OPERADOR: 3, LEITURA: 4 }

/**
 * Bloqueio de escalada (onboarding #20): fora o DONO, só se gerencia e convida papéis
 * estritamente abaixo do próprio (ADMIN não mexe em outro ADMIN).
 */
export function gerencia(ator: Ator, alvo: Papel): boolean {
  return ator.papel === 'DONO' || NIVEL[alvo] > NIVEL[ator.papel]
}

/** Quem tem limite só concede até o próprio limite, e nunca "sem limite". */
function limiteDoAtor(ator: Ator): number | null {
  return ator.papel === 'DONO' ? null : ator.limite
}

export function podeSemLimite(papel: Papel | null, ator: Ator): boolean {
  return semLimitePermitido(papel) && limiteDoAtor(ator) === null
}

export interface MemberForm {
  nome: string
  email: string
  papel: Exclude<Papel, 'DONO'> | null
  permissoes: Permissao[]
  /** `null` = vazio (ou sem limite, quando `semLimite`). */
  limite: number | null
  semLimite: boolean
}

export type FormField = 'nome' | 'email' | 'papel' | 'permissoes' | 'limite'
export type FormErrors = Partial<Record<FormField, string>>

/** Ordem dos campos na tela: o foco vai ao primeiro com erro. */
export const FIELD_ORDER: FormField[] = ['nome', 'email', 'papel', 'permissoes', 'limite']

export function emptyForm(): MemberForm {
  return { nome: '', email: '', papel: null, permissoes: [], limite: null, semLimite: false }
}

export function formFromMember(member: TeamMember): MemberForm {
  return {
    nome: member.nome,
    email: member.email,
    papel: member.papel === 'DONO' ? 'ADMIN' : member.papel,
    permissoes: PERMISSOES.filter((p) => member.permissoes.includes(p)),
    limite: member.limite_pagamento,
    semLimite: member.limite_pagamento === null && semLimitePermitido(member.papel),
  }
}

/**
 * Preset do papel, sem as permissões que quem edita não pode conceder (essas ficam como já
 * estavam: quem não tem a permissão não liga nem desliga).
 */
export function applyPreset(
  form: MemberForm,
  papel: Exclude<Papel, 'DONO'>,
  grantable: (p: Permissao) => boolean,
  ator: Ator = ATOR_DONO,
): MemberForm {
  const preset = PAPEIS[papel].permissoes
  const permissoes = PERMISSOES.filter((p) =>
    grantable(p) ? preset.includes(p) : form.permissoes.includes(p),
  )
  const semLimite = podeSemLimite(papel, ator)
  // Quem tem limite já começa com o próprio limite preenchido (é o máximo que pode conceder).
  const limite = semLimite ? null : (form.limite ?? limiteDoAtor(ator))
  return { ...form, papel, permissoes, semLimite, limite }
}

/** O papel só pode ser escolhido por quem pode conceder todas as permissões do preset. */
export function papelBloqueado(
  papel: Exclude<Papel, 'DONO'>,
  grantable: (p: Permissao) => boolean,
  ator: Ator = ATOR_DONO,
): boolean {
  return !gerencia(ator, papel) || !PAPEIS[papel].permissoes.every(grantable)
}

/** O campo de limite: oculto sem `pagar`; obrigatório fora de DONO/ADMIN. */
export function limiteObrigatorio(form: MemberForm): boolean {
  return form.permissoes.includes('pagar') && !semLimitePermitido(form.papel)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validate(
  form: MemberForm,
  mode: 'invite' | 'edit',
  ator: Ator = ATOR_DONO,
): FormErrors {
  const errors: FormErrors = {}
  if (mode === 'invite') {
    if (!form.nome.trim()) errors.nome = 'Informe o nome da pessoa.'
    if (!form.email.trim()) errors.email = 'Informe o e-mail que ela usa para entrar.'
    else if (!EMAIL.test(form.email.trim()))
      errors.email = 'Confira o e-mail: falta o @ ou o domínio.'
  }
  if (!form.papel) errors.papel = 'Escolha um papel.'
  else if (form.permissoes.length === 0) {
    errors.permissoes = 'Ligue ao menos uma permissão.'
  }
  if (form.permissoes.includes('pagar')) {
    const vazio = form.limite === null
    const teto = limiteDoAtor(ator)
    if (vazio && !(form.semLimite && podeSemLimite(form.papel, ator))) {
      errors.limite = 'Defina até quanto esta pessoa paga sem aprovação.'
    } else if (!vazio && !(form.limite! > 0)) {
      errors.limite = 'O limite precisa ser maior que zero.'
    } else if (!vazio && teto !== null && form.limite! > teto) {
      errors.limite = `Você concede no máximo ${money(teto)}, o seu próprio limite.`
    }
  }
  return errors
}

function limiteDoForm(form: MemberForm, ator: Ator): number | null {
  // Quem tem limite manda sempre um valor (omitir = sem limite, que o back recusa).
  if (!form.permissoes.includes('pagar')) return limiteDoAtor(ator)
  if (form.semLimite && podeSemLimite(form.papel, ator)) return null
  return form.limite
}

export function toInvite(form: MemberForm, ator: Ator = ATOR_DONO): InviteRequest {
  return {
    nome: form.nome.trim(),
    email: form.email.trim().toLowerCase(),
    papel: form.papel!,
    permissoes: form.permissoes,
    limite_pagamento: limiteDoForm(form, ator),
  }
}

export function toPatch(form: MemberForm, ator: Ator = ATOR_DONO): TeamMemberPatch {
  return {
    papel: form.papel!,
    permissoes: form.permissoes,
    limite_pagamento: limiteDoForm(form, ator),
  }
}

/** Erro da API em texto claro e, no 422, por campo. */
export interface TeamFailure {
  code?: string
  message: string
  fields: FormErrors
}

const CAMPO_DA_API: Record<string, FormField> = {
  nome: 'nome',
  email: 'email',
  papel: 'papel',
  permissoes: 'permissoes',
  limite_pagamento: 'limite',
}

export function teamFailure(error: unknown): TeamFailure {
  const body = isAxiosError(error)
    ? (error.response?.data as
        { error?: string; permissao?: Permissao; campos?: Record<string, string> } | undefined)
    : undefined
  const fields: FormErrors = {}
  for (const [campo, texto] of Object.entries(body?.campos ?? {})) {
    const field = CAMPO_DA_API[campo]
    if (field) fields[field] = texto
  }
  // E-mail repetido aparece também no próprio campo.
  if (body?.error === 'EMAIL_JA_CADASTRADO' || body?.error === 'CONVITE_PENDENTE') {
    fields.email = errorMessage(error)
  }
  let message = errorMessage(error)
  if (body?.campos && Object.keys(fields).length) message = 'Revise os campos destacados.'
  const regra = body?.permissao as string | undefined
  if (body?.error === 'SEM_PERMISSAO' && regra === 'hierarquia') {
    message = 'Você só gerencia e convida papéis abaixo do seu.'
    fields.papel = message
  } else if (body?.error === 'SEM_PERMISSAO' && regra === 'limite_pagamento') {
    message = 'O limite de pagamento não pode passar do seu próprio limite.'
    fields.limite = message
  } else if (
    body?.error === 'SEM_PERMISSAO' &&
    body.permissao &&
    PERMISSOES.includes(body.permissao)
  ) {
    message = `Você só concede o que também pode fazer, e não pode ${PERMISSAO_INFO[body.permissao].acao}. ${semPermissaoTexto(body.permissao)}`
  }
  return { code: body?.error, message, fields }
}

// ---------- apresentação ----------

export function initials(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const letras =
    partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? '?').slice(0, 2)
  return letras.toUpperCase()
}

/** Instante ISO (UTC) como dia local `YYYY-MM-DD`. */
export function localDay(instant: string): string {
  return isoDay(new Date(instant))
}

export interface StatusView {
  label: string
  tone: Tone
  detail?: string
}

export function statusView(member: TeamMember, today = new Date()): StatusView {
  const status: MembroStatus = member.status
  if (status === 'ATIVO') return { label: 'Ativo', tone: 'positive' }
  if (status === 'SUSPENSO') return { label: 'Suspenso', tone: 'neutral' }
  if (!member.convite_expira_em) return { label: 'Convidado', tone: 'info' }
  const dias = daysFromToday(localDay(member.convite_expira_em), today)
  if (dias < 0) return { label: 'Convite expirado', tone: 'warning' }
  return {
    label: 'Convidado',
    tone: 'info',
    detail: dias === 0 ? 'expira hoje' : dias === 1 ? 'expira amanhã' : `expira em ${dias} dias`,
  }
}
