import { m } from 'motion/react'

import { ErpIaMark, Faisca } from '@/components/brand/Logo'

import { CASHFLOW, CHART, smoothPath, toX, toY } from './cashflow'
import { ease } from './styles'

const NAV = [
  'Visão geral',
  'Vendas',
  'Recebíveis',
  'Pagamentos',
  'Pendências',
  'Estoque',
  'Crédito',
]

const KPIS = [
  { label: 'Receita 30 dias', value: 'R$ 184.320', note: '+8,2% no mês', tone: 'text-positive' },
  { label: 'Margem estimada', value: '23,4%', note: 'faixa do segmento', tone: 'text-ink-faint' },
  { label: 'Prazo médio de recebimento', value: '34 dias', note: '+6 dias', tone: 'text-negative' },
  { label: 'Ciclo de caixa', value: '41 dias', note: 'meta: 30 dias', tone: 'text-ink-faint' },
]

const line = smoothPath(CASHFLOW)
const area = `${line} L${CHART.width},${toY(0)} L0,${toY(0)} Z`
const zeroY = toY(0)
const dip = { x: (toX(18) / CHART.width) * 100, y: (toY(-31.8) / CHART.height) * 100 }

/**
 * Miniatura do portal (Visão geral) feita em HTML/CSS: KPIs, fluxo de caixa projetado e a
 * oportunidade de crédito marcada com a Faísca. É ilustração: fica fora da árvore acessível e
 * a legenda descreve o que ela mostra.
 */
export function DashboardPreview() {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Prévia do portal da ErpIa para uma padaria: receita de R$ 184.320 em 30 dias, fluxo de caixa
        projetado que fica negativo em 18 dias e a sugestão de antecipar R$ 42 mil de recebíveis
        para cobrir o período.
      </figcaption>
      <div
        aria-hidden
        className="overflow-hidden rounded-panel border border-line bg-surface shadow-overlay select-none"
      >
        <div className="flex">
          <aside className="hidden w-48 shrink-0 flex-col gap-1 bg-rail p-4 text-sm md:flex">
            <div className="mb-5 flex items-center gap-2">
              <ErpIaMark tone="dark" className="size-6" />
              <span className="font-semibold text-rail-ink">ErpIa</span>
            </div>
            {NAV.map((item, i) => (
              <span
                key={item}
                className={
                  i === 0
                    ? 'rounded-control bg-rail-raised px-2.5 py-1.5 text-rail-ink'
                    : 'px-2.5 py-1.5 text-rail-muted'
                }
              >
                {item}
              </span>
            ))}
          </aside>

          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-ink">Padaria Trigo Bom</p>
              <p className="text-xs text-ink-faint">Visão geral · 3 de novembro</p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line lg:grid-cols-4">
              {KPIS.map((kpi) => (
                <div key={kpi.label} className="bg-surface p-3">
                  <dt className="truncate text-2xs text-ink-faint sm:text-xs">{kpi.label}</dt>
                  <dd className="tabular mt-1 text-lg font-medium text-ink sm:text-xl">
                    {kpi.value}
                  </dd>
                  <dd className={`text-2xs ${kpi.tone}`}>{kpi.note}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="rounded-control border border-line p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Fluxo de caixa projetado</p>
                  <p className="text-xs text-ink-faint">60 dias</p>
                </div>
                <div className="relative mt-3 aspect-[10/3]">
                  <svg
                    viewBox={`0 0 ${CHART.width} ${CHART.height}`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full overflow-visible"
                  >
                    <defs>
                      <clipPath id="landing-below-zero">
                        <rect x="0" y={zeroY} width={CHART.width} height={CHART.height - zeroY} />
                      </clipPath>
                    </defs>
                    <path
                      d={area}
                      className="fill-negative-soft"
                      clipPath="url(#landing-below-zero)"
                    />
                    <line
                      x1="0"
                      x2={CHART.width}
                      y1={zeroY}
                      y2={zeroY}
                      className="stroke-line-strong"
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={line}
                      fill="none"
                      className="stroke-accent"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span
                    className="absolute size-2.5 -translate-1/2 rounded-full border-2 border-surface bg-negative"
                    style={{ left: `${dip.x}%`, top: `${dip.y}%` }}
                  />
                  <span
                    className="tabular absolute -translate-x-1/2 translate-y-2 text-2xs font-medium whitespace-nowrap text-negative sm:text-xs"
                    style={{ left: `${dip.x}%`, top: `${dip.y}%` }}
                  >
                    −R$ 31,8 mil em 21/11
                  </span>
                  {/* Ao entrar na tela, a curva é revelada da esquerda para a direita. */}
                  <m.span
                    className="absolute -inset-1 origin-right bg-surface"
                    initial={{ scaleX: 1 }}
                    whileInView={{ scaleX: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 1.4, ease, delay: 0.25 }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-2xs text-ink-faint">
                  <span>hoje</span>
                  <span>30 dias</span>
                  <span>60 dias</span>
                </div>
              </div>

              <m.div
                className="flex flex-col rounded-control border border-credit-line bg-credit-soft p-4"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.8, ease, delay: 1.15 }}
              >
                <p className="flex items-center gap-1.5 text-sm font-medium text-credit-ink">
                  <Faisca label={null} />
                  Oportunidade de crédito
                </p>
                <p className="mt-2 text-sm text-ink">
                  Seu caixa fica negativo em 18 dias. Antecipar R$ 42 mil de recebíveis cobre o
                  vale.
                </p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div>
                    <span className="inline-block rounded-full bg-credit px-2 py-0.5 text-2xs font-medium text-rail">
                      Pré-aprovado
                    </span>
                    <p className="tabular mt-1 text-xl font-medium text-ink">R$ 42.000</p>
                  </div>
                  <span className="rounded-control bg-accent px-3 py-2 text-xs font-medium text-on-accent">
                    Simular
                  </span>
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
