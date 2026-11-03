import { m } from 'motion/react'
import { useId, useState } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { formatCurrency, formatPercent } from '@/lib/format'

import {
  CREDIT_PRODUCTS,
  clampPrazo,
  simular,
  VALOR_MAX,
  VALOR_MIN,
  VALOR_STEP,
  type CreditProductId,
} from './simulator'
import { container, ease, lead, sectionTitle } from './styles'

const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

export function CreditSimulator() {
  const [productId, setProductId] = useState<CreditProductId>('capital-giro')
  const [valor, setValor] = useState(80_000)
  const [prazo, setPrazo] = useState(12)
  const ids = useId()

  const produto = CREDIT_PRODUCTS.find((p) => p.id === productId) ?? CREDIT_PRODUCTS[0]
  const prazoAtual = clampPrazo(produto, prazo)
  const resultado = simular(produto, valor, prazoAtual)
  const taxa = formatPercent(produto.taxaMensal * 100)

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <fieldset className="lg:col-span-6">
        <legend className="sr-only">Produto de crédito</legend>
        <div className="border-t border-line">
          {CREDIT_PRODUCTS.map((p) => (
            <label
              key={p.id}
              className="group relative flex cursor-pointer gap-4 border-b border-line py-5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="produto-credito"
                value={p.id}
                checked={p.id === productId}
                onChange={() => setProductId(p.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full border border-line-strong bg-surface group-has-checked:border-accent"
              >
                <span className="size-2 rounded-full bg-accent opacity-0 transition-opacity group-has-checked:opacity-100" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-lg font-medium text-ink">{p.nome}</span>
                  <span className="text-sm text-ink-faint">em {p.telas}</span>
                </span>
                <span className="mt-1 block text-ink-muted">{p.quando}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <m.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease }}
        className="rounded-panel border border-line bg-surface p-5 shadow-raised sm:p-7 lg:col-span-6"
      >
        <h3 className="font-semibold text-ink">Simule {produto.nome.toLowerCase()}</h3>

        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${ids}-valor`} className="text-sm text-ink-muted">
                {produto.modalidade === 'desconto' ? 'Valor dos recebíveis' : 'Valor'}
              </label>
              <output htmlFor={`${ids}-valor`} className="tabular text-lg font-medium text-ink">
                {reais.format(valor)}
              </output>
            </div>
            <input
              id={`${ids}-valor`}
              type="range"
              min={VALOR_MIN}
              max={VALOR_MAX}
              step={VALOR_STEP}
              value={valor}
              aria-valuetext={reais.format(valor)}
              onChange={(e) => setValor(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-accent"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${ids}-prazo`} className="text-sm text-ink-muted">
                {produto.modalidade === 'desconto' ? 'Prazo até o recebimento' : 'Prazo'}
              </label>
              <output htmlFor={`${ids}-prazo`} className="tabular text-lg font-medium text-ink">
                {meses(prazoAtual)}
              </output>
            </div>
            <input
              id={`${ids}-prazo`}
              type="range"
              min={produto.prazoMin}
              max={produto.prazoMax}
              step={1}
              value={prazoAtual}
              aria-valuetext={meses(prazoAtual)}
              onChange={(e) => setPrazo(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-accent"
            />
          </div>
        </div>

        <div className="mt-7 rounded-control bg-sunken p-4 sm:p-5" aria-live="polite">
          {resultado.modalidade === 'parcelas' ? (
            <>
              <p className="text-sm text-ink-muted">Parcela mensal estimada</p>
              <p className="tabular mt-1 text-[2rem] leading-tight font-medium tracking-[-0.02em] text-ink">
                {formatCurrency(resultado.parcela)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-ink-faint">Total a pagar</dt>
                  <dd className="tabular text-ink">{formatCurrency(resultado.total)}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Juros no período</dt>
                  <dd className="tabular text-ink">{formatCurrency(resultado.juros)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Você recebe hoje</p>
              <p className="tabular mt-1 text-[2rem] leading-tight font-medium tracking-[-0.02em] text-ink">
                {formatCurrency(resultado.liquido)}
              </p>
              <dl className="mt-3 text-sm">
                <dt className="text-ink-faint">Custo da antecipação</dt>
                <dd className="tabular text-ink">{formatCurrency(resultado.custo)}</dd>
              </dl>
            </>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Taxa ilustrativa de {taxa} ao mês, só para referência. Não é proposta: taxa, CET e limite
          reais dependem da análise da sua empresa.
        </p>
      </m.div>
    </div>
  )
}

export function CreditSection() {
  return (
    <section
      id="credito"
      aria-labelledby="credito-title"
      className="border-t border-line bg-surface py-20 sm:py-28"
    >
      <div className={container}>
        <div className="grid gap-6 lg:grid-cols-12">
          <h2 id="credito-title" className={`${sectionTitle} lg:col-span-6`}>
            Crédito em cada tela, quando ele resolve um problema real.
          </h2>
          <div className="lg:col-span-5 lg:col-start-8 lg:pt-2">
            <p className={`${lead} max-w-[56ch]`}>
              A ErpIa cruza vendas, recebíveis, estoque e contas a pagar e só sugere crédito quando
              ele cobre uma necessidade que aparece nos seus números. Cada sugestão mostra valor
              pré-aprovado, custo e o motivo.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-credit-ink">
              <Faisca label={null} />
              Tudo o que a IA sugere vem marcado com a Faísca.
            </p>
          </div>
        </div>
        <div className="mt-12 sm:mt-16">
          <CreditSimulator />
        </div>
      </div>
    </section>
  )
}
