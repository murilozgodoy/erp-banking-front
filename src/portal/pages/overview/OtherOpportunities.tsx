import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { money, pct } from '../../lib/format'
import { PRODUTO_LABEL, simulatorHref } from '../../ui/credit'
import { Panel } from '../../ui/Surface'
import type { Oportunidade } from '../../types'

function prazo(meses: number): string {
  return `até ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

/**
 * As demais ofertas pré-aprovadas (a principal já está no card da Leitura), em linhas compactas:
 * 1 coluna no mobile, 2 no tablet e uma linha só no desktop (até 4).
 */
export function OtherOpportunities({ oportunidades }: { oportunidades: Oportunidade[] }) {
  if (oportunidades.length === 0) return null
  return (
    <Panel
      id="outras-oportunidades"
      title={
        <span className="flex items-center gap-1.5">
          Outras oportunidades
          <Faisca />
        </span>
      }
      description="Também pré-aprovadas pela análise do seu negócio."
      flush
    >
      <ul
        className={cn(
          'grid border-t border-line',
          oportunidades.length > 1 && 'sm:grid-cols-2',
          oportunidades.length === 3 && 'xl:grid-cols-3',
          oportunidades.length >= 4 && 'xl:grid-cols-4',
        )}
      >
        {oportunidades.map((o) => (
          <li
            key={o.tipo}
            className="-mt-px -ml-px flex min-w-0 flex-col gap-1 border-t border-l border-line px-5 py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="min-w-0 truncate text-sm font-semibold text-ink" title={o.titulo}>
                {PRODUTO_LABEL[o.tipo]}
              </h3>
              <p className="tabular shrink-0 text-sm font-semibold whitespace-nowrap text-ink">
                <span className="font-normal text-ink-muted">até </span>
                {money(o.valor_maximo, { compact: o.valor_maximo >= 10_000 })}
              </p>
            </div>
            <p className="line-clamp-2 text-xs text-ink-muted">{o.racional}</p>
            <div className="mt-auto flex items-baseline justify-between gap-3 pt-1">
              <p className="tabular truncate text-xs text-ink-muted">
                {pct(o.taxa_mensal, 2)} a.m. · {prazo(o.prazo_max_meses)}
              </p>
              <Link
                to={simulatorHref(o.tipo, o.valor_maximo)}
                aria-label={`Simular ${PRODUTO_LABEL[o.tipo].toLowerCase()}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
              >
                Simular
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
