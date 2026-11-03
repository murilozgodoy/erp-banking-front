import {
  AnimatePresence,
  m,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'

import { Faisca, Marca } from '@/components/brand/Logo'
import { formatCurrency } from '@/lib/format'

import { BarcodeIcon, CalendarIcon, PixIcon } from './icons'
import { container, ease } from './styles'

type Foco = 'pix' | 'boleto' | 'agenda'

const FEATURES = [
  {
    id: 'pix',
    icon: PixIcon,
    titulo: 'PIX',
    texto: 'Chave ou QR Code, com comprovante na hora.',
  },
  {
    id: 'boleto',
    icon: BarcodeIcon,
    titulo: 'Boletos',
    texto: 'Pague e emita, com baixa automática.',
  },
  {
    id: 'agenda',
    icon: CalendarIcon,
    titulo: 'Agenda de pagamentos',
    texto: 'Contas a pagar e a receber, dia a dia.',
  },
] as const satisfies readonly { id: Foco; icon: typeof PixIcon; titulo: string; texto: string }[]

interface Pagamento {
  id: string
  dia: string
  item: string
  meio: 'PIX' | 'Boleto'
  valor: number
  pago?: boolean
  /** O pagamento que o saldo não cobre e que a ErpIa sugere cobrir com capital de giro. */
  semSaldo?: boolean
}

const AGENDA: readonly Pagamento[] = [
  {
    id: 'moinho',
    dia: 'Seg 3',
    item: 'Moinho Sul · farinha',
    meio: 'Boleto',
    valor: 8_420,
    pago: true,
  },
  { id: 'laticinios', dia: 'Qua 5', item: 'Laticínios Serra', meio: 'Boleto', valor: 5_360 },
  { id: 'folha', dia: 'Qui 6', item: 'Folha · 9 pessoas', meio: 'PIX', valor: 21_900 },
  {
    id: 'embalagens',
    dia: 'Sex 7',
    item: 'Embalagens Vale',
    meio: 'Boleto',
    valor: 3_910,
    semSaldo: true,
  },
]

/** Saldo em conta hoje, já sem o boleto de segunda (pago). */
const SALDO_HOJE = 29_500

/** Saldo no fim de cada dia da agenda; com capital de giro, o boleto sem saldo não sai da conta. */
function saldosDaSemana(comGiro: boolean): number[] {
  let saldo = SALDO_HOJE
  return AGENDA.map((p) => {
    if (!p.pago && !(p.semSaldo && comGiro)) saldo -= p.valor
    return saldo
  })
}

function relacionado(foco: Foco | null, p: Pagamento) {
  if (foco === 'pix') return p.meio === 'PIX'
  if (foco === 'boleto') return p.meio === 'Boleto'
  return foco === 'agenda'
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

const revelar: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
}

const emSequencia: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

/** Valor em reais que conta até o novo número quando muda (corte seco com "reduzir movimento"). */
function ValorContado({ valor, className }: { valor: number; className?: string }) {
  const reduce = useReducedMotion()
  const spring = useSpring(valor, { stiffness: 140, damping: 26 })
  const texto = useTransform(spring, (v) => formatCurrency(Math.round(v)))

  useEffect(() => {
    if (reduce) spring.jump(valor)
    else spring.set(valor)
  }, [reduce, spring, valor])

  return (
    <>
      <m.span aria-hidden className={className}>
        {texto}
      </m.span>
      <span className="sr-only">{formatCurrency(valor)}</span>
    </>
  )
}

/** Barra fina que acende no item da lista ou na linha relacionada da agenda. */
function Indicador({ ativo, className }: { ativo: boolean; className: string }) {
  return (
    <m.span
      aria-hidden
      initial={false}
      animate={{ scaleY: ativo ? 1 : 0, opacity: ativo ? 1 : 0 }}
      transition={{ duration: 0.24, ease }}
      className={`pointer-events-none absolute w-0.5 rounded-full bg-accent ${className}`}
    />
  )
}

function GraficoSaldo({ saldos, foco }: { saldos: number[]; foco: Foco | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const visivel = useInView(ref, { once: true, margin: '-60px' })
  const max = Math.max(...saldos, SALDO_HOJE)

  return (
    <div ref={ref} aria-hidden className="grid min-h-24 flex-1 grid-cols-4 gap-3 sm:gap-4">
      {AGENDA.map((p, i) => {
        const saldo = saldos[i]
        const negativo = saldo < 0
        const apagado = foco !== null && !relacionado(foco, p)
        return (
          <div
            key={p.id}
            data-testid={`barra-${p.id}`}
            className={`flex flex-col transition-opacity duration-200 ${apagado ? 'opacity-35' : 'opacity-100'}`}
          >
            <span
              className={`tabular text-center text-xs ${negativo ? 'font-medium text-negative' : 'text-rail-muted'}`}
            >
              {compacto.format(saldo)}
            </span>
            {/* 80% da altura para o saldo positivo e 20% abaixo da linha do zero. */}
            <div className="relative mt-1.5 flex-1">
              <div className="absolute inset-x-0 top-[80%] h-px bg-rail-muted/30" />
              <m.div
                initial={false}
                animate={{ scaleY: visivel ? saldo / max : 0 }}
                transition={{ duration: 0.6, ease, delay: visivel ? i * 0.06 : 0 }}
                className={`absolute inset-x-1 top-0 h-[80%] origin-bottom rounded-t-[3px] sm:inset-x-3 ${
                  negativo ? 'bg-negative' : p.pago ? 'bg-rail-muted/45' : 'bg-accent/80'
                }`}
              />
            </div>
            <span
              className={`relative mt-2 text-center text-xs transition-colors duration-200 ${
                foco === 'agenda' ? 'text-rail-ink' : 'text-rail-muted'
              }`}
            >
              {p.dia}
              <m.span
                initial={false}
                animate={{
                  scaleX: foco === 'agenda' ? 1 : 0,
                  opacity: foco === 'agenda' ? 1 : 0,
                }}
                transition={{ duration: 0.24, ease }}
                className="absolute inset-x-[30%] -bottom-1 h-0.5 rounded-full bg-accent"
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}

function AgendaInterativa({ foco, id }: { foco: Foco | null; id: string }) {
  const [comGiro, setComGiro] = useState(false)
  const saldos = saldosDaSemana(comGiro)
  const saldoSexta = saldos[saldos.length - 1]

  return (
    <div
      id={id}
      className="flex h-full flex-col rounded-panel border border-rail-raised bg-rail-raised p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">Agenda desta semana</p>
        <p className="tabular text-sm text-rail-muted">Saldo hoje {formatCurrency(SALDO_HOJE)}</p>
      </div>

      <div className="mt-4 flex flex-1 flex-col rounded-control bg-rail/60 p-3 sm:px-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs">
          <span className="text-rail-muted">Saldo no fim do dia</span>
          <span className="text-rail-muted">
            Sexta:{' '}
            <ValorContado
              valor={saldoSexta}
              className={`tabular font-medium ${saldoSexta < 0 ? 'text-negative' : 'text-rail-ink'}`}
            />
          </span>
        </div>
        <GraficoSaldo saldos={saldos} foco={foco} />
      </div>

      <m.ul
        variants={emSequencia}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        aria-label="Pagamentos da semana"
        className="mt-4 divide-y divide-rail"
      >
        {AGENDA.map((p, i) => {
          const ligado = relacionado(foco, p)
          const apagado = foco !== null && !ligado
          const semSaldo = p.semSaldo && !comGiro
          const status = p.pago
            ? 'Pago'
            : p.semSaldo
              ? comGiro
                ? 'Agendado · capital de giro'
                : 'Sem saldo'
              : 'Agendado'
          const MeioIcon = p.meio === 'PIX' ? PixIcon : BarcodeIcon
          return (
            <m.li
              key={p.id}
              variants={revelar}
              data-destaque={ligado || undefined}
              className={`relative grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 py-3 pl-3 text-sm transition-opacity duration-200 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto_6.5rem] sm:gap-x-3 ${
                apagado ? 'opacity-45' : 'opacity-100'
              }`}
            >
              <Indicador ativo={ligado} className="top-2.5 bottom-2.5 left-0" />
              <span
                className={`tabular transition-colors duration-200 ${
                  foco === 'agenda' ? 'font-medium text-rail-ink' : 'text-rail-muted'
                }`}
              >
                {p.dia}
              </span>
              <span className="flex min-w-0 items-center gap-2 self-center">
                <MeioIcon
                  className={`hidden size-4 shrink-0 transition-colors duration-200 sm:block ${
                    ligado && foco !== 'agenda' ? 'text-accent' : 'text-rail-muted'
                  }`}
                />
                <span className="truncate">{p.item}</span>
                <span className="hidden sm:sr-only sm:inline">, {p.meio}</span>
              </span>
              <span className="tabular col-start-3 row-start-1 text-right sm:col-start-4">
                {formatCurrency(p.valor)}
              </span>
              <span className="col-start-2 row-start-2 truncate text-xs text-rail-muted sm:col-start-3 sm:row-start-1 sm:text-right">
                <span className="sm:hidden">{p.meio} · </span>
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={status}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease }}
                    className={`inline-block ${
                      semSaldo ? 'font-medium text-negative' : p.semSaldo ? 'text-credit' : ''
                    }`}
                  >
                    {status}
                  </m.span>
                </AnimatePresence>
              </span>
              {/* O gráfico acima mostra o saldo de cada dia; aqui ele vai para o leitor de tela. */}
              <span className="sr-only">Saldo após: {formatCurrency(saldos[i])}</span>
            </m.li>
          )
        })}
      </m.ul>

      <div className="mt-4 rounded-control border border-credit/40 p-4">
        <div aria-live="polite">
          <p className="flex items-center gap-1.5 text-sm font-medium text-credit">
            <Faisca label={null} />
            {comGiro ? 'Saldo cobre os 4 pagamentos' : 'Saldo cobre 3 de 4 pagamentos'}
          </p>
          <p className="mt-1 text-sm text-rail-muted">
            {comGiro
              ? 'Embalagens Vale sai do capital de giro por cerca de R$ 86 no mês. As vendas de sábado repõem o caixa.'
              : 'Na sexta o saldo fica negativo. Com capital de giro, custa cerca de R$ 86 no mês e evita multa e juros.'}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={comGiro}
          onClick={() => setComGiro((v) => !v)}
          className={`relative mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-control border px-10 text-sm font-medium transition-colors duration-150 ease-out-expo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            comGiro
              ? 'border-accent/60 bg-transparent text-accent hover:bg-accent/10'
              : 'border-accent bg-accent text-rail hover:bg-accent/90'
          }`}
        >
          <m.svg
            viewBox="0 0 20 20"
            aria-hidden
            initial={false}
            animate={{ opacity: comGiro ? 1 : 0, scale: comGiro ? 1 : 0.6 }}
            transition={{ duration: 0.2, ease }}
            className="absolute left-4 size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </m.svg>
          Pagar Embalagens Vale com capital de giro
        </button>
      </div>
    </div>
  )
}

export function BankingSection() {
  const [hover, setHover] = useState<Foco | null>(null)
  const [fixo, setFixo] = useState<Foco | null>(null)
  const foco = hover ?? fixo
  const agendaId = useId()

  return (
    <section
      id="banking"
      aria-labelledby="banking-title"
      className="bg-rail py-20 text-rail-ink surface-dark sm:py-28"
    >
      <div className={`${container} grid items-stretch gap-12 lg:grid-cols-12 lg:gap-10`}>
        <div className="flex flex-col lg:col-span-5">
          <h2
            id="banking-title"
            className="max-w-[14ch] text-[clamp(1.875rem,1.2rem+2.6vw,2.875rem)] leading-[1.08] font-semibold tracking-[-0.028em]"
          >
            O banco da empresa, dentro do ERP.
          </h2>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-rail-muted lg:mb-10">
            Pague, receba e organize a semana sem trocar de sistema. Cada pagamento já entra no
            fluxo de caixa, e o saldo que você vê é o mesmo que a <Marca /> usa para projetar.
          </p>
          <m.ul
            variants={emSequencia}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            aria-label="Destaque na agenda"
            className="mt-10 divide-y divide-rail-raised border-y border-rail-raised lg:mt-auto"
            onMouseLeave={() => setHover(null)}
          >
            {FEATURES.map(({ id, icon: Icon, titulo, texto }) => {
              const ativo = foco === id
              return (
                <m.li key={id} variants={revelar}>
                  <button
                    type="button"
                    aria-pressed={fixo === id}
                    aria-controls={agendaId}
                    onMouseEnter={() => setHover(id)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                    onClick={() => setFixo((atual) => (atual === id ? null : id))}
                    className="relative grid min-h-11 w-full grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 py-6 pl-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Indicador ativo={ativo} className="top-6 bottom-6 left-0" />
                    <Icon
                      className={`mt-0.5 size-5 shrink-0 transition-colors duration-200 ${
                        ativo ? 'text-accent' : 'text-rail-muted'
                      }`}
                    />
                    <span>
                      <span className="block font-medium">{titulo}</span>
                      <span className="mt-0.5 block text-rail-muted">{texto}</span>
                    </span>
                  </button>
                </m.li>
              )
            })}
          </m.ul>
        </div>

        <m.figure
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.32, ease }}
          className="m-0 lg:col-span-7 lg:col-start-6 lg:pl-6"
        >
          <figcaption className="sr-only">
            Exemplo de agenda de pagamentos da semana: o saldo cobre três dos quatro pagamentos e a
            ErpIa sugere capital de giro para o último.
          </figcaption>
          <AgendaInterativa foco={foco} id={agendaId} />
        </m.figure>
      </div>
    </section>
  )
}
