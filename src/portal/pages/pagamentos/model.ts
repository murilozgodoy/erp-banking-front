import { isAxiosError } from 'axios'

import { errorMessage } from '@/lib/errors'

import { money } from '../../lib/format'
import type {
  ErpApiError,
  Payable,
  PayableCategoria,
  PayableStatus,
  PaymentRequest,
  TipoPagamento,
} from '../../types'
import type { Tone } from '../../ui/Pill'

export const CATEGORIA_LABEL: Record<PayableCategoria, string> = {
  FORNECEDOR: 'Fornecedor',
  FOLHA: 'Folha',
  IMPOSTO: 'Imposto',
  ALUGUEL: 'Aluguel',
  SERVICOS: 'Serviços',
  EMPRESTIMO: 'Empréstimo',
}

export const STATUS_PILL: Record<PayableStatus, { label: string; tone: Tone }> = {
  ABERTO: { label: 'Em aberto', tone: 'neutral' },
  ATRASADO: { label: 'Atrasada', tone: 'negative' },
  AGENDADO: { label: 'Agendada', tone: 'info' },
  PAGO: { label: 'Paga', tone: 'positive' },
}

export const TIPO_LABEL: Record<TipoPagamento, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  TED: 'TED',
}

/** Conta que ainda pode ser paga pelo portal. */
export function pagavel(conta: Payable): boolean {
  return conta.status === 'ABERTO' || conta.status === 'ATRASADO'
}

export const digits = (value: string) => value.replace(/\D/g, '')

/** Linha digitável de boleto (47 dígitos) no formato do banco: 5.5 5.6 5.6 1 14. */
export function formatLinhaDigitavel(value: string): string {
  const d = digits(value).slice(0, 47)
  const parts = [
    [0, 5],
    [5, 10],
    [10, 15],
    [15, 21],
    [21, 26],
    [26, 32],
    [32, 33],
    [33, 47],
  ] as const
  const seps = ['.', ' ', '.', ' ', '.', ' ', ' ']
  let out = ''
  parts.forEach(([from, to], index) => {
    const chunk = d.slice(from, to)
    if (!chunk) return
    if (index > 0) out += seps[index - 1]
    out += chunk
  })
  return out
}

// ---------- formulário ----------

export type Quando = 'agora' | 'agendar'

export interface PaymentForm {
  tipo: TipoPagamento
  valor: number | null
  /** Nome do recebedor, beneficiário ou favorecido. */
  nome: string
  chavePix: string
  linhaDigitavel: string
  banco: string
  agencia: string
  conta: string
  descricao: string
  quando: Quando
  data: string
}

export type FormErrors = Partial<Record<keyof PaymentForm, string>>

export function emptyForm(tipo: TipoPagamento = 'PIX'): PaymentForm {
  return {
    tipo,
    valor: null,
    nome: '',
    chavePix: '',
    linhaDigitavel: '',
    banco: '',
    agencia: '',
    conta: '',
    descricao: '',
    quando: 'agora',
    data: '',
  }
}

/** Formulário já preenchido a partir de uma conta a pagar (valor travado no da conta). */
export function formFromPayable(conta: Payable, today: string): PaymentForm {
  const boleto = Boolean(conta.codigo_barras)
  return {
    ...emptyForm(boleto ? 'BOLETO' : 'PIX'),
    valor: conta.valor,
    nome: conta.fornecedor,
    linhaDigitavel: conta.codigo_barras ? formatLinhaDigitavel(conta.codigo_barras) : '',
    descricao: `${CATEGORIA_LABEL[conta.categoria]} · ${conta.fornecedor}`,
    data: conta.vencimento > today ? conta.vencimento : '',
  }
}

/** Validação no cliente, com as mesmas regras do Transactions e mensagens que dizem como corrigir. */
export function validate(form: PaymentForm, today: string): FormErrors {
  const errors: FormErrors = {}
  if (form.valor === null || !(form.valor > 0)) errors.valor = 'Informe um valor maior que zero.'
  if (!form.nome.trim()) {
    errors.nome = {
      PIX: 'Informe o nome de quem recebe.',
      BOLETO: 'Informe o beneficiário do boleto.',
      TED: 'Informe o nome do favorecido.',
    }[form.tipo]
  }
  if (form.tipo === 'PIX' && !form.chavePix.trim()) {
    errors.chavePix = 'Informe a chave PIX: CPF/CNPJ, e-mail, celular ou chave aleatória.'
  }
  if (form.tipo === 'BOLETO' && digits(form.linhaDigitavel).length !== 47) {
    errors.linhaDigitavel = `A linha digitável tem 47 dígitos; você digitou ${digits(form.linhaDigitavel).length}.`
  }
  if (form.tipo === 'TED') {
    if (!/^\d{3}$/.test(form.banco.trim())) {
      errors.banco = 'Use o código do banco com 3 dígitos (ex.: 341).'
    }
    if (!/^\d{4}$/.test(form.agencia.trim())) errors.agencia = 'A agência tem 4 dígitos.'
    if (!/^\d{3,12}-?[\dXx]$/.test(form.conta.trim())) {
      errors.conta = 'Informe a conta com o dígito (ex.: 12345-6).'
    }
  }
  if (form.quando === 'agendar') {
    if (!form.data) errors.data = 'Escolha a data do pagamento.'
    else if (form.data < today) errors.data = 'Escolha hoje ou uma data futura.'
  }
  return errors
}

/** Só agenda de verdade quando a data é futura; hoje = pagar agora. */
export function scheduledFor(form: PaymentForm, today: string): string | undefined {
  return form.quando === 'agendar' && form.data > today ? form.data : undefined
}

/** Texto do destinatário enviado à API: os dados bancários vão dobrados no texto. */
export function destinatario(form: PaymentForm): string {
  const nome = form.nome.trim()
  if (form.tipo === 'PIX') return `${nome} · chave ${form.chavePix.trim()}`
  if (form.tipo === 'TED') {
    return `${nome} · banco ${form.banco.trim()} · ag. ${form.agencia.trim()} · cc ${form.conta.trim()}`
  }
  return nome
}

export function toRequest(form: PaymentForm, today: string, payableId?: number): PaymentRequest {
  const request: PaymentRequest = {
    tipo: form.tipo,
    valor: form.valor ?? 0,
    destinatario: destinatario(form),
    descricao: form.descricao.trim() || `Pagamento ${TIPO_LABEL[form.tipo]}`,
  }
  if (payableId !== undefined) request.payable_id = payableId
  const agendado = scheduledFor(form, today)
  if (agendado) request.agendado_para = agendado
  if (form.tipo === 'BOLETO') request.codigo_barras = digits(form.linhaDigitavel)
  return request
}

// ---------- erros da API ----------

export type PayFailure =
  | { kind: 'saldo'; faltam: number }
  | { kind: 'campos'; errors: FormErrors; message: string }
  | { kind: 'conta'; code: string; message: string }
  | { kind: 'outro'; message: string }

/** Campo da API → campo do formulário. */
const CAMPO_API: Record<string, keyof PaymentForm> = {
  valor: 'valor',
  destinatario: 'nome',
  agendado_para: 'data',
  codigo_barras: 'linhaDigitavel',
  descricao: 'descricao',
  tipo: 'tipo',
}

export function apiError(error: unknown): ErpApiError | undefined {
  if (!isAxiosError(error)) return undefined
  const data: unknown = error.response?.data
  return data && typeof data === 'object' && 'error' in data ? (data as ErpApiError) : undefined
}

export function isOnboardingPendente(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    apiError(error)?.error === 'ONBOARDING_PENDENTE'
  )
}

/** Traduz a falha do `POST /me/payments` no que a tela precisa mostrar. */
export function payFailure(error: unknown, valorConta?: number): PayFailure {
  const body = apiError(error)
  switch (body?.error) {
    case 'SALDO_INSUFICIENTE':
      return { kind: 'saldo', faltam: body.faltam ?? 0 }
    case 'validation_failed': {
      const errors: FormErrors = {}
      for (const [campo, mensagem] of Object.entries(body.campos ?? {})) {
        const key = CAMPO_API[campo]
        if (!key) continue
        errors[key] =
          campo === 'agendado_para' ? 'A data do agendamento precisa ser hoje ou depois.' : mensagem
      }
      return { kind: 'campos', errors, message: 'Revise os campos destacados e tente de novo.' }
    }
    case 'CONTA_JA_PAGA':
      return {
        kind: 'conta',
        code: body.error,
        message:
          'Esta conta já foi paga. Atualizamos a lista; o comprovante está no histórico de pagamentos.',
      }
    case 'CONTA_JA_AGENDADA':
      return {
        kind: 'conta',
        code: body.error,
        message:
          'Esta conta já tem um pagamento agendado e será paga na data marcada. Acompanhe no histórico de pagamentos.',
      }
    case 'CONTA_A_PAGAR_NAO_ENCONTRADA':
      return {
        kind: 'conta',
        code: body.error,
        message:
          'Não encontramos esta conta a pagar; ela pode ter saído do ERP. Atualizamos a lista: confira e tente de novo.',
      }
    case 'VALOR_DIVERGENTE':
      return {
        kind: 'conta',
        code: body.error,
        message: `O valor não confere com o da conta${
          valorConta !== undefined ? ` (${money(valorConta)})` : ''
        }. Atualizamos a lista; abra a conta de novo para pagar o valor certo.`,
      }
    default:
      return { kind: 'outro', message: body?.message ?? errorMessage(error) }
  }
}
