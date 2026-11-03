import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { money, pct } from '../lib/format'
import type { Insight, InsightSeveridade, ProdutoCredito } from '../types'

import { Button, ButtonLink } from './Button'
import { PRODUTO_LABEL, simulatorHref } from './credit'

const severity: Record<InsightSeveridade, { icon: ReactNode; label: string; tone: string }> = {
  info: { icon: <Info className="size-4" />, label: 'Leitura', tone: 'text-info bg-info-soft' },
  atencao: {
    icon: <AlertTriangle className="size-4" />,
    label: 'Atenção',
    tone: 'text-warning bg-warning-soft',
  },
  oportunidade: {
    icon: <Faisca label={null} className="size-4" />,
    label: 'Oportunidade',
    tone: 'bg-credit-soft',
  },
}

export interface InsightOffer {
  produto: ProdutoCredito
  /** Valor pré-aprovado ou sugerido. */
  valor: number
  taxa_mensal?: number
  /** Texto curto de por que a oferta resolve o insight. */
  racional?: string
  /** Rótulo do botão; padrão "Simular". */
  cta?: string
  /** Ação na própria página (ex.: selecionar recebíveis) em vez do link para o simulador. */
  onAction?: () => void
}

interface InsightBlockProps {
  insight?: Pick<Insight, 'titulo' | 'texto' | 'severidade'>
  offer?: InsightOffer
  className?: string
}

/**
 * Bloco de IA de cada aba: o insight ligado à oferta de crédito que o resolve, marcado pela
 * Faísca (DESIGN.md). O lado esquerdo diz o que está acontecendo; o lado lima, como resolver.
 */
export function InsightBlock({ insight, offer, className }: InsightBlockProps) {
  const reduce = useReducedMotion()
  if (!insight && !offer) return null
  const sev = insight ? severity[insight.severidade] : null
  return (
    <motion.aside
      aria-label="Insight da ErpIa"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'grid overflow-hidden rounded-panel border border-line bg-surface shadow-raised',
        offer && insight && 'md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]',
        className,
      )}
    >
      {insight && sev && (
        <div className="flex gap-3 p-4 sm:p-5">
          <span
            aria-hidden
            className={cn('grid size-8 shrink-0 place-items-center rounded-full', sev.tone)}
          >
            {sev.icon}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <span className="sr-only">{sev.label}: </span>
              {insight.titulo}
              <Faisca />
            </p>
            <p className="mt-0.5 max-w-[70ch] text-sm text-ink-muted">{insight.texto}</p>
          </div>
        </div>
      )}
      {offer && (
        <div className="relative flex flex-col justify-between gap-3 border-t border-dashed border-credit-line bg-credit-soft p-4 sm:p-5 md:border-t-0 md:border-l">
          {insight && (
            <span
              aria-hidden
              className="absolute top-1/2 -left-[5px] hidden size-2.5 -translate-y-1/2 rounded-full border border-credit-line bg-surface md:block"
            />
          )}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-credit-ink">
              <Faisca label={null} />
              {PRODUTO_LABEL[offer.produto]} · pré-aprovado
            </p>
            <p className="tabular mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">
              até {money(offer.valor)}
            </p>
            {(offer.taxa_mensal !== undefined || offer.racional) && (
              <p className="mt-0.5 text-xs text-ink-muted">
                {offer.taxa_mensal !== undefined && (
                  <span className="tabular">a partir de {pct(offer.taxa_mensal, 2)} a.m.</span>
                )}
                {offer.taxa_mensal !== undefined && offer.racional && ' · '}
                {offer.racional}
              </p>
            )}
          </div>
          {offer.onAction ? (
            <Button variant="credit" size="sm" className="self-start" onClick={offer.onAction}>
              {offer.cta ?? 'Simular'}
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : (
            <ButtonLink
              to={simulatorHref(offer.produto, offer.valor)}
              variant="credit"
              size="sm"
              className="self-start"
            >
              {offer.cta ?? 'Simular'}
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          )}
        </div>
      )}
    </motion.aside>
  )
}
