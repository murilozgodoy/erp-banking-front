import { ArrowRight, ChevronDown, Sparkle } from 'lucide-react'
import { useState } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { money, pct } from '../../lib/format'
import { Button, ButtonLink } from '../../ui/Button'
import { PRODUTO_LABEL, simulatorHref } from '../../ui/credit'
import { EmptyState, Panel } from '../../ui/Surface'
import type { Oportunidade } from '../../types'

/** Quantas ofertas aparecem antes de "Ver mais" (o painel divide a altura com o gráfico). */
const VISIBLE = 2

function prazo(meses: number): string {
  return `até ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

/**
 * Oportunidades de crédito da análise, na ordem em que a IA as ranqueou: a primeira é a que
 * mais resolve o momento do negócio. Lista, não grade de cards.
 */
export function OpportunitiesPanel({
  oportunidades,
  className,
}: {
  oportunidades: Oportunidade[]
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? oportunidades : oportunidades.slice(0, VISIBLE)
  const hidden = oportunidades.length - visible.length
  return (
    <Panel
      id="oportunidades"
      title={
        <span className="flex items-center gap-1.5">
          Oportunidades de crédito
          <Faisca />
        </span>
      }
      description="Pré-aprovadas pela análise do seu negócio, da mais útil para a menos."
      flush
      className={className}
    >
      {oportunidades.length === 0 ? (
        <EmptyState icon={<Sparkle className="size-5" />} title="Nenhuma oferta no momento">
          As ofertas aparecem aqui quando a análise encontra um crédito que resolve algo no seu
          caixa. Elas são recalculadas a cada 30 dias de vendas.
        </EmptyState>
      ) : (
        <>
          <ol
            id="oportunidades-lista"
            aria-label="Oportunidades de crédito, da mais indicada para a menos"
          >
            {visible.map((o, index) => (
              <li
                key={o.tipo}
                className={cn('border-t border-line px-5 py-4', index === 0 && 'bg-credit-soft/60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-muted">
                      {index === 0 ? (
                        <span className="text-credit-ink">Mais indicada · </span>
                      ) : null}
                      {PRODUTO_LABEL[o.tipo]}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-ink">{o.titulo}</h3>
                  </div>
                  <p className="tabular shrink-0 text-right text-base font-semibold text-ink">
                    <span className="block text-xs font-normal text-ink-muted">até</span>
                    {money(o.valor_maximo, { compact: o.valor_maximo >= 10_000 })}
                  </p>
                </div>
                <p className="tabular mt-1 text-xs text-ink-muted">
                  {pct(o.taxa_mensal, 2)} a.m. · {prazo(o.prazo_max_meses)}
                </p>
                <p className="mt-1.5 text-sm text-ink-muted">{o.racional}</p>
                <ButtonLink
                  to={simulatorHref(o.tipo, o.valor_maximo)}
                  aria-label={`Simular ${PRODUTO_LABEL[o.tipo].toLowerCase()}`}
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                >
                  Simular
                  <ArrowRight aria-hidden className="size-4" />
                </ButtonLink>
              </li>
            ))}
          </ol>
          {oportunidades.length > VISIBLE && (
            <div className="border-t border-line px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={expanded}
                aria-controls="oportunidades-lista"
                onClick={() => setExpanded((v) => !v)}
                icon={
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      'size-4 transition-transform duration-200',
                      expanded && 'rotate-180',
                    )}
                  />
                }
              >
                {expanded
                  ? 'Mostrar menos'
                  : `Ver mais ${hidden} ${hidden === 1 ? 'oferta' : 'ofertas'}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
