import { ArrowRight, CircleCheck } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { TimeSeriesChart } from '../../charts/TimeSeriesChart'
import { dayMonth, money, pct } from '../../lib/format'
import { GatedButtonLink } from '../../ui/Gated'
import { PRODUTO_LABEL, simulatorHref } from '../../ui/credit'
import { Money } from '../../ui/Money'
import { Panel, Skeleton } from '../../ui/Surface'
import type { FluxoCaixaDia, Oportunidade } from '../../types'

import { creditBridge, findVales, lowestPoint, shortMoney, valeRange, type Vale } from './cashflow'

interface CashPanelProps {
  saldo: number
  fluxo: FluxoCaixaDia[]
  /** Oportunidades da análise; vazio enquanto ela não chega. */
  oportunidades: Oportunidade[]
  /** A análise ainda está carregando (a ponte espera a oferta). */
  analysisPending?: boolean
  className?: string
}

/**
 * Painel-assinatura da visão geral: o caixa projetado de 60 dias com o vale destacado e, logo
 * abaixo, a ponte de crédito que cobre o vale.
 */
export function CashPanel({
  saldo,
  fluxo,
  oportunidades,
  analysisPending,
  className,
}: CashPanelProps) {
  const vales = useMemo(() => findVales(fluxo), [fluxo])
  const low = lowestPoint(fluxo)
  const byDate = useMemo(() => new Map(fluxo.map((d) => [d.data, d])), [fluxo])
  const today = fluxo[0]?.data
  const chartBox = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(280)
  useLayoutEffect(() => {
    const box = chartBox.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      // 16 px de respiro embaixo (o antigo pb-4).
      setChartHeight(Math.max(280, Math.round(entry.contentRect.height) - 16))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <Panel
      id="caixa"
      title="Caixa projetado — 60 dias"
      description="Saldo de hoje somado aos recebíveis e às vendas previstas, menos as contas em aberto."
      flush
      className={cn(
        'flex flex-col overflow-hidden [&>div:last-child]:flex [&>div:last-child]:flex-1 [&>div:last-child]:flex-col',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 pb-2">
        <div>
          <p className="text-xs font-medium text-ink-muted">Saldo hoje</p>
          <Money value={saldo} size="display" className="text-ink" />
        </div>
        {low && (
          <div className="sm:text-right">
            <p className="text-xs font-medium text-ink-muted">Menor saldo do período</p>
            <p className="flex items-baseline gap-2 sm:justify-end">
              <Money
                value={low.valor}
                size="lg"
                className={low.valor < 0 ? 'text-negative' : 'text-ink'}
              />
              <span className="text-sm text-ink-muted">em {dayMonth(low.data)}</span>
            </p>
          </div>
        )}
      </div>

      {/* O gráfico ocupa a altura que sobrar quando o card estica (mínimo 280 px); fica em
          posição absoluta para não empurrar a altura da linha. */}
      <div ref={chartBox} className="relative min-h-[296px] flex-1">
        <div className="absolute inset-x-0 top-0 px-3 sm:px-5">
          <TimeSeriesChart
            title="Caixa projetado nos próximos 60 dias"
            height={chartHeight}
            negativeZone
            series={[
              {
                key: 'saldo',
                label: 'Saldo projetado',
                color: 'var(--color-series-1)',
                area: true,
                values: fluxo.map((d) => ({ date: d.data, value: d.saldo_projetado })),
              },
            ]}
            marker={today ? { date: today, label: 'Hoje' } : undefined}
            bands={vales.map((vale) => ({
              from: vale.inicio,
              to: vale.fim ?? fluxo[fluxo.length - 1].data,
              label: `Vale ${valeRange(vale)}`,
              className: 'fill-negative/10',
            }))}
            tooltipExtra={(date) => {
              const dia = byDate.get(date)
              if (!dia) return null
              return (
                <div className="mt-1.5 space-y-0.5 border-t border-line pt-1.5">
                  <p className="flex justify-between gap-3 text-ink-muted">
                    Entradas
                    <span className="tabular font-medium text-positive">
                      +{money(dia.entradas, { compact: true })}
                    </span>
                  </p>
                  <p className="flex justify-between gap-3 text-ink-muted">
                    Saídas
                    <span className="tabular font-medium text-negative">
                      −{money(dia.saidas, { compact: true })}
                    </span>
                  </p>
                </div>
              )
            }}
          />
        </div>
      </div>

      <div className="mt-auto">
        {vales.length > 0 ? (
          <ValeBridge
            vale={vales[0]}
            minimo={low?.valor ?? 0}
            extraVales={vales.length - 1}
            oportunidades={oportunidades}
            analysisPending={analysisPending}
          />
        ) : (
          <div className="flex items-start gap-3 border-t border-line bg-positive-soft px-5 py-4">
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-positive" />
            <div>
              <p className="font-semibold text-ink">Seu caixa cobre os próximos 60 dias</p>
              <p className="text-sm text-ink-muted">
                Com as vendas atuais, o saldo projetado paga todas as contas do período
                {low && (
                  <>
                    {' '}
                    e não fica abaixo de <span className="tabular">{money(low.valor)}</span>
                  </>
                )}
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function ValeBridge({
  vale,
  minimo,
  extraVales,
  oportunidades,
  analysisPending,
}: {
  vale: Vale
  minimo: number
  extraVales: number
  oportunidades: Oportunidade[]
  analysisPending?: boolean
}) {
  const bridge = creditBridge(minimo, oportunidades)
  const range = valeRange(vale)
  return (
    <div
      className={cn(
        'grid border-t border-line',
        (bridge || analysisPending) && 'md:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)]',
      )}
    >
      <div className="px-5 py-4">
        <p className="font-semibold text-ink">
          Vale de caixa {range}
          {vale.fim && (
            <span className="font-normal text-ink-muted">
              {' '}
              · {vale.dias} {vale.dias === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          O saldo fica negativo a partir de {dayMonth(vale.inicio)}
          {vale.fim ? '' : ' e não volta ao positivo nos 60 dias'} e chega a{' '}
          <span className="tabular font-medium text-negative">{money(minimo)}</span>
          {extraVales > 0 &&
            `. Há mais ${extraVales} ${extraVales === 1 ? 'trecho negativo' : 'trechos negativos'} no período`}
          .
        </p>
      </div>
      {analysisPending && !bridge && (
        <div
          role="status"
          aria-label="Buscando a oferta que cobre o vale"
          className="space-y-2 border-t border-dashed border-credit-line bg-credit-soft px-5 py-4 md:border-t-0 md:border-l"
        >
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-8 w-36" />
        </div>
      )}
      {bridge && (
        <div className="flex flex-col justify-between gap-3 border-t border-dashed border-credit-line bg-credit-soft px-5 py-4 md:border-t-0 md:border-l">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-credit-ink">
              <Faisca />
              {PRODUTO_LABEL[bridge.oportunidade.tipo]} · pré-aprovado
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {bridge.oportunidade.tipo === 'ANTECIPACAO_RECEBIVEIS' ? 'Antecipar' : 'Tomar'}{' '}
              <span className="tabular">{shortMoney(bridge.valor)}</span>{' '}
              {bridge.cobre ? 'cobre o vale' : 'reduz o vale'} {range}
            </p>
            <p className="tabular mt-0.5 text-xs text-ink-muted">
              a partir de {pct(bridge.oportunidade.taxa_mensal, 2)} a.m. · limite de{' '}
              {shortMoney(bridge.oportunidade.valor_maximo)}
            </p>
          </div>
          <GatedButtonLink
            permissao="pedir_credito"
            to={simulatorHref(bridge.oportunidade.tipo, bridge.valor)}
            variant="credit"
            size="sm"
            className="self-start"
          >
            {bridge.oportunidade.tipo === 'ANTECIPACAO_RECEBIVEIS'
              ? `Simular antecipação de ${shortMoney(bridge.valor)}`
              : `Simular capital de giro de ${shortMoney(bridge.valor)}`}
            <ArrowRight aria-hidden className="size-4" />
          </GatedButtonLink>
        </div>
      )}
    </div>
  )
}
