import {
  animate,
  LazyMotion,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'motion/react'
import { useEffect, useId, useState } from 'react'

import { Marca } from '@/components/brand/Logo'
import { formatCurrency, formatPercent } from '@/lib/format'

import { ArrowRightIcon } from './icons'
import {
  CREDIT_PRODUCTS,
  clampPrazo,
  simular,
  tabelaPrice,
  VALOR_MAX,
  VALOR_MIN,
  VALOR_STEP,
  type CreditProduct,
  type CreditProductId,
} from './simulator'
import { container, ease, lead, primaryButton, sectionTitle } from './styles'
import { useLandingAuth } from './useLandingAuth'

/** `domMax` (layoutId) sob demanda: a landing carrega só `domAnimation`. */
const loadMotionMax = () => import('./creditMotion').then((mod) => mod.default)

const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const inteiros = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`
const pct = (parte: number, todo: number) => `${Math.round((parte / todo) * 100)}%`

/** Revelação ao rolar: 10 px + opacidade, ease-out-expo, filhos em cascata de 70 ms. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease, staggerChildren: 0.07 } },
}
/** Troca de produto: o conteúdo do painel entra de novo. */
const swap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease },
}
const springy = { type: 'spring', duration: 0.4, bounce: 0 } as const

/** Thumb de 22 px; trilha e bolha usam a mesma conta para seguir o centro do thumb. */
const THUMB = 22
const thumbCenter = (ratio: number) => `calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB}px)`

const rangeInput = [
  'relative block h-11 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none',
  '[&::-webkit-slider-runnable-track]:h-11 [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:mt-[11px] [&::-webkit-slider-thumb]:size-[22px] [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent',
  '[&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-raised',
  '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150',
  'hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110',
  'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-accent/30',
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-surface',
  'focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-accent/30',
].join(' ')

interface SliderProps {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}

function Slider({ id, label, min, max, step, value, format, onChange }: SliderProps) {
  const ratio = max === min ? 0 : (value - min) / (max - min)
  return (
    <div className="group">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      <div className="relative mt-9">
        <output
          htmlFor={id}
          style={{ left: thumbCenter(ratio), transform: `translateX(-${ratio * 100}%)` }}
          className="tabular pointer-events-none absolute bottom-full mb-0.5 rounded-control bg-ink px-2.5 py-1 text-base font-medium whitespace-nowrap text-paper shadow-raised transition-colors duration-150 group-has-focus-visible:bg-accent group-has-focus-visible:text-on-accent"
        >
          {format(value)}
        </output>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-line"
        >
          <span
            className="absolute inset-y-0 left-0 bg-accent"
            style={{ width: thumbCenter(ratio) }}
          />
        </span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className={rangeInput}
        />
      </div>
    </div>
  )
}

/**
 * Valor em reais que conta até o novo número (mola de 400 ms). O texto animado é decorativo: leitores
 * de tela e o aria-live recebem só o valor final.
 */
function Contador({ value }: { value: number }) {
  const still = useReducedMotion() === true
  const mv = useMotionValue(value)
  const inteiro = useTransform(mv, (v) => partes(v)[0])
  const centavos = useTransform(mv, (v) => partes(v)[1])

  useEffect(() => {
    if (still) {
      mv.jump(value)
      return
    }
    const controls = animate(mv, value, springy)
    return () => controls.stop()
  }, [mv, still, value])

  const [inteiroFinal, centavosFinal] = partes(value)
  return (
    <>
      <span className="sr-only">{formatCurrency(value)}</span>
      <span
        aria-hidden
        className="tabular block text-[clamp(2.5rem,1.9rem+2.2vw,3.5rem)] leading-none font-medium tracking-[-0.03em] text-ink"
      >
        <span className="mr-1.5 align-top text-[0.42em] leading-[1.6] font-normal tracking-normal text-ink-muted">
          R$
        </span>
        {still ? (
          <>
            <span>{inteiroFinal}</span>
            <span className={centavosClass}>{centavosFinal}</span>
          </>
        ) : (
          <>
            <m.span>{inteiro}</m.span>
            <m.span className={centavosClass}>{centavos}</m.span>
          </>
        )}
      </span>
    </>
  )
}

const centavosClass = 'text-[0.55em] tracking-[-0.01em] text-ink-muted'

/** Separa reais e centavos (em centavos inteiros, para o arredondamento não desalinhar as partes). */
function partes(valor: number): [string, string] {
  const total = Math.max(0, Math.round(valor * 100))
  return [inteiros.format(Math.floor(total / 100)), `,${String(total % 100).padStart(2, '0')}`]
}

/** Parcelas da tabela Price: a barra é a parcela; em cima, os juros; embaixo, a amortização. */
function ParcelBars({
  produto,
  valor,
  prazo,
}: {
  produto: CreditProduct
  valor: number
  prazo: number
}) {
  const linhas = tabelaPrice(valor, produto.taxaMensal, prazo)
  const parcela = linhas[0].juros + linhas[0].amortizacao
  return (
    <figure className="mt-5 flex flex-1 flex-col">
      <div
        aria-hidden
        data-testid="parcelas"
        className="flex min-h-20 flex-1 items-stretch"
        style={{ gap: prazo > 24 ? 2 : 3 }}
      >
        {linhas.map((linha) => (
          <span key={linha.mes} className="relative flex-1 overflow-hidden rounded-[3px] bg-accent">
            <m.span
              className="absolute inset-0 origin-top bg-line-strong"
              initial={false}
              animate={{ scaleY: Math.min(1, linha.juros / parcela) }}
              transition={springy}
            />
          </span>
        ))}
      </div>
      <figcaption className="tabular mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-accent" />
          Amortização
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-line-strong" />
          Juros
        </span>
        <span className="ml-auto">{prazo} parcelas</span>
      </figcaption>
    </figure>
  )
}

/** Antecipação: uma barra só. A trilha é o valor bruto; o preenchimento, o líquido que entra hoje. */
function BrutoLiquido({ valor, liquido }: { valor: number; liquido: number }) {
  const ratio = liquido / valor
  return (
    <figure className="mt-5 flex flex-1 flex-col justify-end">
      <div aria-hidden data-testid="bruto-liquido">
        <div className="tabular flex justify-between gap-4 text-xs text-ink-muted">
          <span>Líquido sobre o bruto</span>
          <span className="font-medium text-ink">{pct(ratio, 1)}</span>
        </div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-ink-faint/25">
          <m.span
            className="block h-full origin-left rounded-full bg-accent"
            initial={false}
            animate={{ scaleX: ratio }}
            transition={springy}
          />
        </div>
      </div>
    </figure>
  )
}

function ScreenIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="10.5" rx="1.75" />
      <path d="M7 17h6M10 14v3" />
    </svg>
  )
}

function ProductOption({
  produto,
  selected,
  onSelect,
}: {
  produto: CreditProduct
  selected: boolean
  onSelect: () => void
}) {
  const descId = useId()
  return (
    <m.label
      variants={reveal}
      className="group relative flex min-h-11 cursor-pointer items-center justify-center rounded-control px-3 py-2.5 text-center has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent lg:justify-start lg:px-5 lg:py-3.5 lg:text-left"
    >
      {selected && (
        <m.span
          layoutId="credito-produto-selecionado"
          aria-hidden
          className="absolute inset-0 rounded-control border border-line bg-surface shadow-raised"
          transition={{ type: 'spring', duration: 0.42, bounce: 0.12 }}
        />
      )}
      <input
        type="radio"
        name="produto-credito"
        value={produto.id}
        checked={selected}
        onChange={onSelect}
        aria-label={produto.nome}
        aria-describedby={descId}
        className="sr-only"
      />
      <span className="relative min-w-0 flex-1 lg:pl-8">
        <span
          aria-hidden
          className="absolute top-[5px] left-0 hidden size-4 shrink-0 place-items-center rounded-full border border-line-strong bg-surface transition-colors group-has-checked:border-accent lg:grid"
        >
          <span className="size-2 rounded-full bg-accent opacity-0 transition-opacity group-has-checked:opacity-100" />
        </span>
        <span
          aria-hidden
          className="block text-sm font-medium text-ink-muted transition-colors group-has-checked:text-ink lg:hidden"
        >
          {produto.rotulo}
        </span>
        <span
          aria-hidden
          className="hidden text-lg font-medium text-ink-muted transition-colors group-hover:text-ink group-has-checked:text-ink lg:block"
        >
          {produto.nome}
        </span>
        <span id={descId} className="mt-1 hidden text-[0.9375rem] text-ink-muted lg:block">
          {produto.quando}
        </span>
      </span>
    </m.label>
  )
}

export function CreditSimulator() {
  const [productId, setProductId] = useState<CreditProductId>('capital-giro')
  const [valor, setValor] = useState(80_000)
  const [prazo, setPrazo] = useState(12)
  const ids = useId()
  const { signup } = useLandingAuth()

  const produto = CREDIT_PRODUCTS.find((p) => p.id === productId) ?? CREDIT_PRODUCTS[0]
  const prazoAtual = clampPrazo(produto, prazo)
  const resultado = simular(produto, valor, prazoAtual)
  const taxa = formatPercent(produto.taxaMensal * 100)
  const desconto = produto.modalidade === 'desconto'

  return (
    <LazyMotion features={loadMotionMax}>
      <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch lg:gap-8">
        <m.fieldset
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="min-w-0 lg:col-span-5 lg:flex lg:flex-col"
        >
          <legend className="sr-only">Produto de crédito</legend>
          <div className="grid grid-cols-2 gap-1 rounded-panel bg-sunken p-1 sm:grid-cols-4 lg:flex-1 lg:grid-cols-1 lg:grid-rows-4 lg:p-1.5">
            {CREDIT_PRODUCTS.map((p) => (
              <ProductOption
                key={p.id}
                produto={p}
                selected={p.id === productId}
                onSelect={() => setProductId(p.id)}
              />
            ))}
          </div>
        </m.fieldset>

        <m.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="flex min-w-0 flex-col rounded-panel border border-line bg-surface p-5 shadow-raised sm:p-7 lg:col-span-7 lg:p-8"
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <m.div key={productId} {...swap} className="min-w-0">
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">
                Simule {produto.nome.toLowerCase()}
              </h3>
              <p className="mt-1 text-sm text-ink-muted lg:hidden">{produto.quando}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                <ScreenIcon />
                Aparece em {produto.telas}
              </p>
            </m.div>
            <span className="tabular mt-0.5 shrink-0 rounded-full bg-sunken px-2.5 py-1 text-xs whitespace-nowrap text-ink-muted">
              {taxa} a.m., ilustrativa
            </span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
            <Slider
              id={`${ids}-valor`}
              label={desconto ? 'Valor dos recebíveis' : 'Valor'}
              min={VALOR_MIN}
              max={VALOR_MAX}
              step={VALOR_STEP}
              value={valor}
              format={(v) => reais.format(v)}
              onChange={setValor}
            />
            <Slider
              id={`${ids}-prazo`}
              label={desconto ? 'Prazo até o recebimento' : 'Prazo'}
              min={produto.prazoMin}
              max={produto.prazoMax}
              step={1}
              value={prazoAtual}
              format={meses}
              onChange={setPrazo}
            />
          </div>

          <div
            className="mt-6 flex flex-1 flex-col rounded-panel bg-sunken p-5 sm:p-6"
            aria-live="polite"
          >
            <m.div key={productId} {...swap} className="flex flex-1 flex-col">
              <p className="text-sm text-ink-muted">
                {desconto ? 'Você recebe hoje' : 'Parcela mensal estimada'}
              </p>
              <div className="mt-2">
                <Contador
                  value={
                    resultado.modalidade === 'parcelas' ? resultado.parcela : resultado.liquido
                  }
                />
              </div>
              <dl className="tabular mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-ink-faint sm:gap-x-2">
                <div className="flex gap-1.5">
                  <dt>{desconto ? 'Valor bruto' : 'Total'}</dt>
                  <dd className="font-medium text-ink">
                    {resultado.modalidade === 'parcelas'
                      ? formatCurrency(resultado.total)
                      : reais.format(valor)}
                  </dd>
                </div>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <div className="flex gap-1.5">
                  <dt>{desconto ? 'custo' : 'juros'}</dt>
                  <dd className="font-medium text-ink">
                    {formatCurrency(
                      resultado.modalidade === 'parcelas' ? resultado.juros : resultado.custo,
                    )}
                  </dd>
                </div>
              </dl>
              {resultado.modalidade === 'parcelas' ? (
                <ParcelBars produto={produto} valor={valor} prazo={prazoAtual} />
              ) : (
                <BrutoLiquido valor={valor} liquido={resultado.liquido} />
              )}
            </m.div>
          </div>

          <button type="button" onClick={signup} className={`${primaryButton} mt-5 w-full`}>
            Simular com os meus números
            <ArrowRightIcon />
          </button>
          <p className="mt-2.5 text-xs text-ink-faint">
            Taxa ilustrativa. Condições reais dependem da análise da sua empresa.
          </p>
        </m.div>
      </div>
    </LazyMotion>
  )
}

export function CreditSection() {
  return (
    <section
      id="credito"
      aria-labelledby="credito-title"
      className="border-t border-line bg-surface py-16 sm:py-24"
    >
      <div className={container}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="credito-title" className={`${sectionTitle} max-w-[18ch] lg:col-span-6`}>
            Crédito em cada tela, quando ele resolve um problema real.
          </h2>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className={`${lead} max-w-[48ch]`}>
              A <Marca /> só sugere crédito quando ele resolve algo que aparece nos seus números.
            </p>
          </div>
        </div>
        <div className="mt-10 sm:mt-12">
          <CreditSimulator />
        </div>
      </div>
    </section>
  )
}
