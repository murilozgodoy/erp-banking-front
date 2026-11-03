import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, Copy, Printer } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { dayMonth, fullDate, isoDay, money } from '../../lib/format'
import type { ContaOrigem, Payable, PaymentResponse, TipoPagamento } from '../../types'
import { Button, ButtonLink } from '../../ui/Button'
import { simulatorHref } from '../../ui/credit'
import { MoneyField, TextField } from '../../ui/Field'
import { Money } from '../../ui/Money'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'
import {
  CATEGORIA_LABEL,
  emptyForm,
  formatLinhaDigitavel,
  formFromPayable,
  payFailure,
  scheduledFor,
  TIPO_LABEL,
  toRequest,
  validate,
  type FormErrors,
  type PayFailure,
  type PaymentForm,
} from './model'
import { usePay } from './queries'
import './receipt.css'

type Step =
  | { name: 'form' }
  | { name: 'confirm' }
  | { name: 'saldo'; faltam: number }
  | { name: 'receipt'; result: PaymentResponse }

interface PaymentSheetProps {
  open: boolean
  onClose: () => void
  /** Conta a pagar de origem; sem ela, é um pagamento avulso. */
  payable: Payable | null
  saldo: number | undefined
  conta: ContaOrigem | null
}

const TIPOS: { value: TipoPagamento; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TED', label: 'TED' },
]

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' })

const contaLabel = (conta: ContaOrigem | null) =>
  conta ? `Ag. ${conta.agencia} · CC ${conta.numero}` : 'Conta PJ'

/**
 * Pagar em três passos: dados → confirmação (valor e saldo após) → comprovante. Saldo
 * insuficiente vira um passo próprio, com a diferença e o capital de giro para cobri-la.
 */
export function PaymentSheet({ open, onClose, payable, saldo, conta }: PaymentSheetProps) {
  const today = isoDay(new Date())
  const [form, setForm] = useState<PaymentForm>(() =>
    payable ? formFromPayable(payable, today) : emptyForm(),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [step, setStep] = useState<Step>({ name: 'form' })
  const [failure, setFailure] = useState<PayFailure | null>(null)
  const pay = usePay()
  const formId = useId()
  const reduce = useReducedMotion()
  const heading = useRef<HTMLDivElement>(null)

  // Leitores de tela acompanham a troca de passo.
  useEffect(() => {
    if (step.name !== 'form') heading.current?.focus()
  }, [step.name])

  const set = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const review = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(form, today)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length === 0) setStep({ name: 'confirm' })
  }

  const confirm = () => {
    setFailure(null)
    pay.mutate(toRequest(form, today, payable?.id), {
      onSuccess: (result) => setStep({ name: 'receipt', result }),
      onError: (error) => {
        const reason = payFailure(error, payable?.valor)
        if (reason.kind === 'saldo') return setStep({ name: 'saldo', faltam: reason.faltam })
        if (reason.kind === 'campos') {
          setErrors(reason.errors)
          setStep({ name: 'form' })
        }
        if (reason.kind === 'conta') void pay.refresh()
        setFailure(reason)
      },
    })
  }

  const scheduleInstead = () => {
    setForm((current) => ({ ...current, quando: 'agendar' }))
    setFailure(null)
    setStep({ name: 'form' })
  }

  const scheduled = scheduledFor(form, today)
  const blocked = failure?.kind === 'conta'

  const footer: Record<Step['name'], ReactNode> = {
    form: (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" form={formId}>
          Revisar pagamento
        </Button>
      </>
    ),
    confirm: blocked ? (
      <Button variant="secondary" onClick={onClose}>
        Voltar às contas
      </Button>
    ) : (
      <>
        <Button variant="ghost" onClick={() => setStep({ name: 'form' })} disabled={pay.isPending}>
          Voltar e editar
        </Button>
        <Button onClick={confirm} loading={pay.isPending}>
          {scheduled ? 'Confirmar agendamento' : 'Confirmar pagamento'}
        </Button>
      </>
    ),
    saldo: (
      <>
        <Button variant="ghost" onClick={() => setStep({ name: 'form' })}>
          Voltar
        </Button>
        <Button variant="secondary" onClick={scheduleInstead}>
          Agendar para outra data
        </Button>
      </>
    ),
    receipt: <Button onClick={onClose}>Concluir</Button>,
  }

  const title = payable ? `Pagar ${payable.fornecedor}` : 'Novo pagamento'
  const description = payable
    ? `${CATEGORIA_LABEL[payable.categoria]} · vence ${dayMonth(payable.vencimento)}`
    : 'PIX, boleto ou TED a partir da conta PJ.'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer[step.name]}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.name}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {step.name === 'form' && (
            <FormStep
              id={formId}
              form={form}
              errors={errors}
              set={set}
              onSubmit={review}
              today={today}
              fromPayable={Boolean(payable)}
              failure={failure}
            />
          )}
          {step.name === 'confirm' && (
            <ConfirmStep
              headingRef={heading}
              form={form}
              saldo={saldo}
              conta={conta}
              scheduled={scheduled}
              failure={failure}
            />
          )}
          {step.name === 'saldo' && (
            <SaldoStep headingRef={heading} faltam={step.faltam} valor={form.valor ?? 0} />
          )}
          {step.name === 'receipt' && <ReceiptStep headingRef={heading} result={step.result} />}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  )
}

// ---------- passo 1: dados ----------

interface FormStepProps {
  id: string
  form: PaymentForm
  errors: FormErrors
  set: <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => void
  onSubmit: (event: FormEvent) => void
  today: string
  fromPayable: boolean
  failure: PayFailure | null
}

function FormStep({ id, form, errors, set, onSubmit, today, fromPayable, failure }: FormStepProps) {
  const nomeLabel = { PIX: 'Nome de quem recebe', BOLETO: 'Beneficiário', TED: 'Favorecido' }[
    form.tipo
  ]
  return (
    <form id={id} noValidate onSubmit={onSubmit} className="space-y-5">
      {failure && failure.kind !== 'saldo' && <Notice tone="negative">{failure.message}</Notice>}

      <div className="space-y-1.5">
        <p aria-hidden className="text-sm font-medium text-ink">
          Forma de pagamento
        </p>
        <Segmented
          label="Forma de pagamento"
          value={form.tipo}
          options={TIPOS}
          onChange={(tipo) => set('tipo', tipo)}
        />
      </div>

      {form.tipo === 'BOLETO' && (
        <TextField
          label="Linha digitável"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
          value={form.linhaDigitavel}
          readOnly={fromPayable && Boolean(form.linhaDigitavel) && !errors.linhaDigitavel}
          onChange={(event) =>
            set('linhaDigitavel', formatLinhaDigitavel(event.currentTarget.value))
          }
          error={errors.linhaDigitavel}
          hint="Os 47 números impressos acima do código de barras."
          className="[&_input]:tabular"
        />
      )}

      <TextField
        label={nomeLabel}
        required
        autoComplete="off"
        value={form.nome}
        onChange={(event) => set('nome', event.currentTarget.value)}
        error={errors.nome}
      />

      {form.tipo === 'PIX' && (
        <TextField
          label="Chave PIX"
          required
          autoComplete="off"
          value={form.chavePix}
          onChange={(event) => set('chavePix', event.currentTarget.value)}
          error={errors.chavePix}
          hint="CPF/CNPJ, e-mail, celular ou chave aleatória."
        />
      )}

      {form.tipo === 'TED' && (
        <div className="grid gap-4 sm:grid-cols-[6rem_6rem_minmax(0,1fr)]">
          <TextField
            label="Banco"
            required
            inputMode="numeric"
            maxLength={3}
            placeholder="341"
            value={form.banco}
            onChange={(event) => set('banco', event.currentTarget.value)}
            error={errors.banco}
          />
          <TextField
            label="Agência"
            required
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            value={form.agencia}
            onChange={(event) => set('agencia', event.currentTarget.value)}
            error={errors.agencia}
          />
          <TextField
            label="Conta com dígito"
            required
            inputMode="numeric"
            placeholder="12345-6"
            value={form.conta}
            onChange={(event) => set('conta', event.currentTarget.value)}
            error={errors.conta}
          />
        </div>
      )}

      <MoneyField
        label="Valor"
        required
        value={form.valor}
        onValueChange={(valor) => set('valor', valor)}
        readOnly={fromPayable}
        error={errors.valor}
        hint={
          fromPayable
            ? 'Valor da conta. Para pagar outro valor, use Novo pagamento.'
            : 'Sai do saldo disponível da conta PJ.'
        }
        className={cn(fromPayable && '[&_input]:bg-sunken')}
      />

      <TextField
        label="Descrição"
        autoComplete="off"
        maxLength={140}
        value={form.descricao}
        onChange={(event) => set('descricao', event.currentTarget.value)}
        hint="Aparece no extrato e no comprovante."
      />

      <div className="space-y-3">
        <p aria-hidden className="-mb-1.5 text-sm font-medium text-ink">
          Quando pagar
        </p>
        <Segmented
          label="Quando pagar"
          value={form.quando}
          options={[
            { value: 'agora', label: 'Pagar agora' },
            { value: 'agendar', label: 'Agendar' },
          ]}
          onChange={(quando) => set('quando', quando)}
        />
        {form.quando === 'agendar' && (
          <TextField
            label="Data do pagamento"
            type="date"
            required
            min={today}
            value={form.data}
            onChange={(event) => set('data', event.currentTarget.value)}
            error={errors.data}
            hint="O valor sai da conta nesta data. Hoje = pagar agora."
            className="max-w-56"
          />
        )}
      </div>
    </form>
  )
}

// ---------- passo 2: confirmação ----------

interface ConfirmStepProps {
  headingRef: RefObject<HTMLDivElement | null>
  form: PaymentForm
  saldo: number | undefined
  conta: ContaOrigem | null
  scheduled: string | undefined
  failure: PayFailure | null
}

function ConfirmStep({ headingRef, form, saldo, conta, scheduled, failure }: ConfirmStepProps) {
  const valor = form.valor ?? 0
  const after = saldo === undefined ? undefined : saldo - valor
  const short = !scheduled && after !== undefined && after < 0
  return (
    <div className="space-y-5">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <p className="text-sm text-ink-muted">
          {scheduled ? `Agendar para ${fullDate(scheduled)}` : 'Você vai pagar agora'}
        </p>
        <Money value={valor} size="display" className="mt-1 block text-ink" />
        <p className="mt-1 text-sm text-ink-muted">
          para <span className="font-medium text-ink">{form.nome.trim()}</span> via{' '}
          {TIPO_LABEL[form.tipo]}
        </p>
      </div>

      {failure && failure.kind !== 'saldo' && <Notice tone="negative">{failure.message}</Notice>}

      <dl className="divide-y divide-line rounded-control border border-line text-sm">
        {form.tipo === 'BOLETO' && (
          <Row label="Linha digitável">
            <span className="tabular break-all">{form.linhaDigitavel}</span>
          </Row>
        )}
        {form.tipo === 'PIX' && <Row label="Chave PIX">{form.chavePix.trim()}</Row>}
        {form.tipo === 'TED' && (
          <Row label="Dados bancários">
            <span className="tabular">
              Banco {form.banco.trim()} · Ag. {form.agencia.trim()} · CC {form.conta.trim()}
            </span>
          </Row>
        )}
        {form.descricao.trim() && <Row label="Descrição">{form.descricao.trim()}</Row>}
        <Row label="Conta de origem">
          <span className="tabular">{contaLabel(conta)}</span>
        </Row>
        <Row label="Data">{scheduled ? fullDate(scheduled) : 'Hoje, na confirmação'}</Row>
      </dl>

      {saldo !== undefined && (
        <dl className="grid grid-cols-2 gap-4 rounded-control bg-sunken px-4 py-3">
          <div>
            <dt className="text-xs text-ink-muted">Saldo agora</dt>
            <dd className="tabular font-semibold text-ink">{money(saldo)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">
              {scheduled ? 'Saldo após (hoje)' : 'Saldo após'}
            </dt>
            <dd className={cn('tabular font-semibold', short ? 'text-negative' : 'text-ink')}>
              {money(scheduled ? saldo : (after as number))}
            </dd>
          </div>
          {scheduled && (
            <p className="col-span-2 text-xs text-ink-muted">
              O saldo não muda hoje: o valor sai da conta em {fullDate(scheduled)}.
            </p>
          )}
        </dl>
      )}

      {short && (
        <Notice tone="warning">
          O saldo de hoje não cobre este pagamento: faltam {money(-(after as number))}. Agende para
          outra data ou cubra a diferença com capital de giro.
        </Notice>
      )}
    </div>
  )
}

// ---------- saldo insuficiente ----------

function SaldoStep({
  headingRef,
  faltam,
  valor,
}: {
  headingRef: RefObject<HTMLDivElement | null>
  faltam: number
  valor: number
}) {
  return (
    <div className="space-y-5">
      <div ref={headingRef} tabIndex={-1} role="alert" className="flex gap-3 outline-none">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-warning"
        >
          <AlertTriangle className="size-4" />
        </span>
        <div>
          <p className="text-base font-semibold text-ink">Saldo insuficiente</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Faltam <span className="tabular font-semibold text-ink">{money(faltam)}</span> para
            pagar <span className="tabular">{money(valor)}</span> hoje. Nada foi debitado.
          </p>
        </div>
      </div>

      <div className="rounded-panel border border-dashed border-credit-line bg-credit-soft p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-credit-ink">
          <Faisca label={null} />
          Capital de giro cobre a diferença
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Simule {money(Math.ceil(faltam))} de capital de giro, receba na conta e volte para pagar
          hoje.
        </p>
        <ButtonLink
          to={simulatorHref('CAPITAL_DE_GIRO', Math.ceil(faltam))}
          variant="credit"
          size="sm"
          className="mt-3"
        >
          Pagar com capital de giro
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </div>
  )
}

// ---------- comprovante ----------

function ReceiptStep({
  headingRef,
  result,
}: {
  headingRef: RefObject<HTMLDivElement | null>
  result: PaymentResponse
}) {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null)
  const c = result.comprovante
  const agendado = result.status === 'AGENDADO'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.autenticacao)
      setCopied('ok')
    } catch {
      setCopied('erro')
    }
  }

  return (
    <div className="space-y-5">
      <div ref={headingRef} tabIndex={-1} className="flex items-center gap-3 outline-none">
        <motion.span
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            agendado ? 'bg-info-soft text-info' : 'bg-positive-soft text-positive',
          )}
        >
          <Check className="size-5" />
        </motion.span>
        <div>
          <p className="text-base font-semibold text-ink">
            {agendado ? 'Pagamento agendado' : 'Pagamento efetivado'}
          </p>
          <p className="text-sm text-ink-muted">
            {agendado && c.agendado_para
              ? `O valor sai da conta em ${fullDate(c.agendado_para)}.`
              : `Saldo após o pagamento: ${money(result.saldo_apos)}.`}
          </p>
        </div>
      </div>

      <section
        data-receipt
        aria-labelledby="comprovante-titulo"
        className="rounded-panel border border-line bg-surface"
      >
        <div className="border-b border-line px-4 py-3">
          <h3 id="comprovante-titulo" className="text-sm font-semibold text-ink">
            Comprovante de {agendado ? 'agendamento' : 'pagamento'}
          </h3>
          <Money value={c.valor} size="xl" className="mt-1 block text-ink" />
        </div>
        <dl className="divide-y divide-line text-sm">
          <Row label="Forma">{TIPO_LABEL[c.tipo]}</Row>
          <Row label="Destinatário">{c.destinatario}</Row>
          {c.descricao && <Row label="Descrição">{c.descricao}</Row>}
          {c.codigo_barras && (
            <Row label="Linha digitável">
              <span className="tabular break-all">{formatLinhaDigitavel(c.codigo_barras)}</span>
            </Row>
          )}
          <Row label={agendado ? 'Agendado em' : 'Data e hora'}>
            <span className="tabular">{dateTime.format(new Date(c.data_hora))}</span>
          </Row>
          {c.agendado_para && <Row label="Pagamento em">{fullDate(c.agendado_para)}</Row>}
          <Row label="Conta de origem">
            <span className="tabular">{contaLabel(c.conta_origem)}</span>
          </Row>
          <Row label="Autenticação">
            <span className="tabular font-medium break-all">{c.autenticacao}</span>
          </Row>
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy className="size-4" />}
          onClick={() => void copy()}
        >
          Copiar autenticação
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Printer className="size-4" />}
          onClick={() => window.print()}
        >
          Imprimir comprovante
        </Button>
        <p aria-live="polite" className="text-xs text-ink-muted">
          {copied === 'ok' && 'Autenticação copiada.'}
          {copied === 'erro' && 'Não deu para copiar; selecione o código e copie manualmente.'}
        </p>
      </div>
    </div>
  )
}

// ---------- peças ----------

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'negative' | 'warning'; children: ReactNode }) {
  return (
    <p
      role="alert"
      className={cn(
        'flex gap-2 rounded-control px-3 py-2.5 text-sm text-ink',
        tone === 'negative' ? 'bg-negative-soft' : 'bg-warning-soft',
      )}
    >
      <AlertTriangle
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'negative' ? 'text-negative' : 'text-warning',
        )}
      />
      <span>{children}</span>
    </p>
  )
}
