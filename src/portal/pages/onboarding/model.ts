import { isValidCnpj, money, number, pct } from '../../lib/format'
import type {
  CampoErro,
  CampoTemplate,
  Empresa,
  OnboardingDraft,
  OnboardingPayload,
  OnboardingTemplate,
  RespostaValor,
  Respostas,
  Segmento,
} from '../../types'

/** Estado inteiro do wizard: é o que vai no `PUT /me/onboarding`. */
export interface WizardState {
  empresa: Empresa
  segmento: Segmento | null
  respostas: Respostas
  observacoes: string
}

/** Erro por campo, com a mesma chave do 422: "empresa.<campo>", "segmento" ou o id do template. */
export type Errors = Record<string, string>

export const STEPS = [
  { id: 'empresa', nome: 'Empresa', titulo: 'Dados da empresa' },
  { id: 'segmento', nome: 'Segmento', titulo: 'Segmento do negócio' },
  { id: 'perguntas', nome: 'Perguntas', titulo: 'Como o negócio funciona' },
  { id: 'revisao', nome: 'Revisão', titulo: 'Observações e revisão' },
] as const

export const LAST_STEP = STEPS.length - 1

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] // prettier-ignore

export const EMPRESA_LABELS: Record<keyof Empresa, string> = {
  razao_social: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  cidade: 'Cidade',
  estado: 'Estado',
  fundacao_ano: 'Ano de fundação',
  funcionarios: 'Funcionários',
}

const EMPRESA_OBRIGATORIOS: (keyof Empresa)[] = [
  'razao_social',
  'cnpj',
  'email',
  'telefone',
  'cidade',
  'estado',
]

/** Campos que só existem quando outro campo booleano é "sim". */
export const CONDICIONAIS: Record<string, string> = { valor_estoque: 'possui_estoque' }

export const OBRIGATORIO = 'Campo obrigatório.'

export function emptyEmpresa(): Empresa {
  return {
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    cidade: '',
    estado: '',
    fundacao_ano: null,
    funcionarios: null,
  }
}

export function fromDraft(draft: OnboardingDraft | null | undefined): WizardState {
  const empresa = { ...emptyEmpresa(), ...(draft?.empresa ?? {}) }
  return {
    empresa: {
      ...empresa,
      razao_social: empresa.razao_social ?? '',
      nome_fantasia: empresa.nome_fantasia ?? '',
      cnpj: (empresa.cnpj ?? '').replace(/\D/g, ''),
      email: empresa.email ?? '',
      telefone: (empresa.telefone ?? '').replace(/\D/g, ''),
      cidade: empresa.cidade ?? '',
      estado: empresa.estado ?? '',
      fundacao_ano: empresa.fundacao_ano ?? null,
      funcionarios: empresa.funcionarios ?? null,
    },
    segmento: draft?.segmento ?? null,
    respostas: { ...(draft?.respostas ?? {}) },
    observacoes: draft?.observacoes ?? '',
  }
}

export function templateOf(
  templates: OnboardingTemplate[],
  segmento: Segmento | null,
): OnboardingTemplate | null {
  return templates.find((template) => template.segmento === segmento) ?? null
}

export function isVisible(campo: CampoTemplate, respostas: Respostas): boolean {
  const gatilho = CONDICIONAIS[campo.id]
  return !gatilho || respostas[gatilho] === true
}

export function isRequired(campo: CampoTemplate, respostas: Respostas): boolean {
  return Boolean(campo.obrigatorio) || (campo.id in CONDICIONAIS && isVisible(campo, respostas))
}

export function camposDe(template: OnboardingTemplate | null): CampoTemplate[] {
  return template?.secoes.flatMap((secao) => secao.campos) ?? []
}

export function isEmpty(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    (typeof valor === 'string' && valor.trim() === '') ||
    (Array.isArray(valor) && valor.length === 0) ||
    (typeof valor === 'number' && Number.isNaN(valor))
  )
}

/** Limites efetivos: percentuais vão de 0 a 100 mesmo se o template não disser. */
export function boundsOf(campo: CampoTemplate): { min?: number; max?: number } {
  if (campo.tipo === 'percent') return { min: campo.min ?? 0, max: campo.max ?? 100 }
  return { min: campo.min, max: campo.max }
}

/** Mesmas regras do servidor (tipo, inteiro, limites e opções). */
export function validateCampo(
  campo: CampoTemplate,
  valor: RespostaValor | undefined,
  required: boolean,
): string | null {
  if (isEmpty(valor)) return required ? OBRIGATORIO : null
  switch (campo.tipo) {
    case 'boolean':
      return typeof valor === 'boolean' ? null : 'Responda sim ou não.'
    case 'text':
      return typeof valor === 'string' ? null : 'Texto inválido.'
    case 'select':
      return campo.opcoes?.includes(String(valor)) ? null : 'Escolha uma das opções.'
    case 'multiselect':
      return Array.isArray(valor) && valor.every((v) => campo.opcoes?.includes(v))
        ? null
        : 'Escolha entre as opções da lista.'
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'Informe um número.'
  if (campo.tipo === 'integer' && !Number.isInteger(valor)) return 'Informe um número inteiro.'
  const { min, max } = boundsOf(campo)
  if ((min !== undefined && valor < min) || (max !== undefined && valor > max)) {
    if (max === undefined) return `O valor mínimo é ${number(min ?? 0)}.`
    if (min === undefined) return `O valor máximo é ${number(max)}.`
    return `Informe um valor entre ${number(min)} e ${number(max)}.`
  }
  return null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmpresa(empresa: Empresa, today = new Date()): Errors {
  const errors: Errors = {}
  for (const campo of EMPRESA_OBRIGATORIOS) {
    if (isEmpty(empresa[campo])) errors[`empresa.${campo}`] = OBRIGATORIO
  }
  if (!errors['empresa.cnpj'] && !isValidCnpj(empresa.cnpj)) {
    errors['empresa.cnpj'] = 'CNPJ inválido: confira os 14 dígitos.'
  }
  if (!errors['empresa.email'] && !EMAIL.test(empresa.email ?? '')) {
    errors['empresa.email'] = 'Informe um e-mail no formato nome@empresa.com.br.'
  }
  const telefone = (empresa.telefone ?? '').replace(/\D/g, '')
  if (!errors['empresa.telefone'] && (telefone.length < 10 || telefone.length > 11)) {
    errors['empresa.telefone'] = 'Informe o telefone com DDD (10 ou 11 dígitos).'
  }
  if (!errors['empresa.estado'] && !UFS.includes(empresa.estado)) {
    errors['empresa.estado'] = 'Escolha a UF.'
  }
  const ano = empresa.fundacao_ano
  const anoAtual = today.getFullYear()
  if (ano !== null && (ano < 1900 || ano > anoAtual)) {
    errors['empresa.fundacao_ano'] = `Informe um ano entre 1900 e ${anoAtual}.`
  }
  if (empresa.funcionarios !== null && empresa.funcionarios < 0) {
    errors['empresa.funcionarios'] = 'Informe zero ou mais.'
  }
  return errors
}

export function validateSegmento(segmento: Segmento | null): Errors {
  return segmento ? {} : { segmento: 'Escolha o segmento do negócio.' }
}

export function validateRespostas(
  template: OnboardingTemplate | null,
  respostas: Respostas,
): Errors {
  const errors: Errors = {}
  for (const campo of camposDe(template)) {
    if (!isVisible(campo, respostas)) continue
    const erro = validateCampo(campo, respostas[campo.id], isRequired(campo, respostas))
    if (erro) errors[campo.id] = erro
  }
  return errors
}

export function validateStep(
  step: number,
  state: WizardState,
  template: OnboardingTemplate | null,
): Errors {
  if (step === 0) return validateEmpresa(state.empresa)
  if (step === 1) return validateSegmento(state.segmento)
  if (step === 2) return validateRespostas(template, state.respostas)
  return {}
}

export function validateAll(state: WizardState, template: OnboardingTemplate | null): Errors {
  return {
    ...validateEmpresa(state.empresa),
    ...validateSegmento(state.segmento),
    ...(state.segmento ? validateRespostas(template, state.respostas) : {}),
  }
}

/** Primeiro passo com pendência (retomada do rascunho). */
export function firstIncompleteStep(
  state: WizardState,
  template: OnboardingTemplate | null,
): number {
  for (let step = 0; step < LAST_STEP; step++) {
    if (Object.keys(validateStep(step, state, template)).length > 0) return step
  }
  return LAST_STEP
}

/** Em que passo está o campo de uma chave de erro. */
export function stepOfKey(key: string, template: OnboardingTemplate | null): number {
  if (key.startsWith('empresa.')) return 0
  if (key === 'segmento') return 1
  if (camposDe(template).some((campo) => campo.id === key)) return 2
  return LAST_STEP
}

export function labelOfKey(key: string, template: OnboardingTemplate | null): string {
  if (key.startsWith('empresa.')) {
    return EMPRESA_LABELS[key.slice('empresa.'.length) as keyof Empresa] ?? key
  }
  if (key === 'segmento') return 'Segmento'
  if (key === 'observacoes') return 'Observações'
  return camposDe(template).find((campo) => campo.id === key)?.label ?? key
}

/** Erros ordenados pela ordem dos passos e dos campos na tela. */
export function orderedErrors(errors: Errors, template: OnboardingTemplate | null): string[] {
  const ordem = [
    ...Object.keys(EMPRESA_LABELS).map((campo) => `empresa.${campo}`),
    'segmento',
    ...camposDe(template).map((campo) => campo.id),
    'observacoes',
  ]
  const posicao = (key: string) => {
    const index = ordem.indexOf(key)
    return index < 0 ? ordem.length : index
  }
  return Object.keys(errors).sort((a, b) => posicao(a) - posicao(b))
}

/** Converte o 422 `{campos:[{campo, erro}]}` no mapa de erros. */
export function errorsFromServer(campos: CampoErro[] | undefined): Errors {
  const errors: Errors = {}
  for (const { campo, erro } of campos ?? []) errors[campo] ??= erro
  return errors
}

/**
 * Corpo do `PUT /me/onboarding`. O rascunho leva o estado inteiro; o envio leva só as respostas
 * do template escolhido (e sem campos condicionais escondidos).
 */
export function toPayload(
  state: WizardState,
  enviar: boolean,
  template: OnboardingTemplate | null = null,
): OnboardingPayload {
  const empresa: Empresa = {
    ...state.empresa,
    email: state.empresa.email?.trim() ? state.empresa.email.trim() : null,
    telefone: state.empresa.telefone ? state.empresa.telefone : null,
  }
  let respostas = state.respostas
  if (enviar && template) {
    respostas = Object.fromEntries(
      camposDe(template)
        .filter((campo) => isVisible(campo, state.respostas) && campo.id in state.respostas)
        .map((campo) => [campo.id, state.respostas[campo.id]]),
    )
  }
  return { empresa, segmento: state.segmento, respostas, observacoes: state.observacoes, enviar }
}

// ---------- máscaras e leitura de números ----------

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  const split = rest.length > 8 ? 5 : 4
  if (rest.length <= split) return `(${ddd}) ${rest}`
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

/** "12,5" ou "12.5" → 12.5; `null` se vazio ou inválido. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
  const value = Number(normalized.replace(/[^\d.-]/g, ''))
  return /\d/.test(normalized) && Number.isFinite(value) ? value : null
}

/** Só dígitos → inteiro; `null` se vazio. */
export function parseInteger(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

export function decimalText(value: RespostaValor | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value).replace('.', ',') : ''
}

// ---------- revisão ----------

export function formatAnswer(campo: CampoTemplate, valor: RespostaValor | undefined): string {
  if (isEmpty(valor)) return 'Não informado'
  switch (campo.tipo) {
    case 'currency':
      return typeof valor === 'number' ? money(valor) : String(valor)
    case 'percent':
      return typeof valor === 'number' ? pct(valor, Number.isInteger(valor) ? 0 : 1) : String(valor)
    case 'number':
    case 'integer':
      return typeof valor === 'number'
        ? number(valor, Number.isInteger(valor) ? 0 : 1)
        : String(valor)
    case 'boolean':
      return valor === true ? 'Sim' : 'Não'
    case 'multiselect':
      return Array.isArray(valor) ? valor.join(', ') : String(valor)
    default:
      return String(valor)
  }
}
