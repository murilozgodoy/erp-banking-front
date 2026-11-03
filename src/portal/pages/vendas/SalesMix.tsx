import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { ShareBar } from '../../charts/ShareBar'
import { money, pct } from '../../lib/format'
import { Panel } from '../../ui/Surface'
import type { SalesReport } from '../../types'

import { FORMA_LABEL } from './period'

/** "Formas de pagamento" e "Canais", lado a lado em telas largas. */
export function SalesMix({ report }: { report: SalesReport }) {
  const credito = report.por_forma_pagamento.find((f) => f.forma === 'CARTAO_CREDITO')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        id="vendas-formas"
        title="Formas de pagamento"
        description="Como seus clientes pagam e quanto disso entra na hora."
      >
        <ShareBar
          title="Faturamento por forma de pagamento"
          shares={report.por_forma_pagamento.map((f) => ({
            key: f.forma,
            label: FORMA_LABEL[f.forma] ?? f.forma,
            value: f.valor,
            pct: f.pct,
          }))}
        />
        {credito && credito.valor > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
            <p className="text-ink-muted">
              <span className="tabular font-medium text-ink">{money(credito.valor)}</span> no cartão
              de crédito ({pct(credito.pct, 0)}). Ele chega em 30 dias ou mais; a parte que ainda
              não caiu pode ser antecipada.
            </p>
            <Link
              to="/app/recebiveis"
              className="inline-flex items-center gap-1 rounded font-medium text-accent hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ver recebíveis
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        )}
      </Panel>
      <Panel id="vendas-canais" title="Canais" description="Onde as vendas acontecem.">
        <ShareBar
          title="Faturamento por canal"
          shares={report.por_canal.map((c) => ({
            key: c.canal,
            label: c.canal,
            value: c.valor,
            pct: c.pct,
          }))}
        />
      </Panel>
    </div>
  )
}
