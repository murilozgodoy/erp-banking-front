import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Faisca, Marca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { pct } from '../../lib/format'
import { ButtonLink } from '../../ui/Button'
import { PRODUTO_LABEL, simulatorHref } from '../../ui/credit'
import { Money } from '../../ui/Money'
import type { BusinessAnalysis } from '../../types'

import type { MainOffer } from './cashflow'

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Atualizada em 03/11 às 14:20 · regras + IA". */
function footer(analysis: BusinessAnalysis): string | null {
  const parts: string[] = []
  if (analysis.atualizado_em) {
    const [dia, hora] = dateTime.format(new Date(analysis.atualizado_em)).split(', ')
    parts.push(`Atualizada em ${dia} às ${hora}`)
  }
  if (analysis.gerado_por)
    parts.push(analysis.gerado_por === 'llm+regras' ? 'regras + IA' : 'regras')
  return parts.length ? parts.join(' · ') : null
}

function prazo(meses: number): string {
  return `até ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

/**
 * Card "Leitura da ErpIa" ao lado do caixa: o resumo da análise (com os sinais em "Ler análise
 * completa") e, embaixo, a oportunidade principal com o valor pré-aprovado. Estica até a altura
 * do gráfico (a oferta fica presa ao rodapé).
 */
export function LeituraCard({
  analysis,
  offer,
  className,
}: {
  analysis: BusinessAnalysis
  offer: MainOffer | null
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const sinais = [
    ...analysis.pontos_fortes.map((text) => ({
      tone: 'positive' as const,
      label: 'Ponto forte',
      text,
    })),
    ...analysis.riscos.map((text) => ({ tone: 'warning' as const, label: 'Atenção', text })),
  ]
  // Sempre visíveis: 1 ponto forte + 1 atenção (ou 2 do que houver); o resto no expandido.
  const fortes = sinais.filter((x) => x.tone === 'positive')
  const atencao = sinais.filter((x) => x.tone === 'warning')
  const nFortes = Math.min(fortes.length, atencao.length > 0 ? 1 : 2)
  const principais = [...fortes.slice(0, nFortes), ...atencao].slice(0, 2)
  const visiveis = expanded ? sinais : principais
  const temMais = sinais.length > principais.length || (analysis.resumo?.length ?? 0) > 220
  const rodape = footer(analysis)
  return (
    <section
      aria-labelledby="leitura-erpia-title"
      className={cn(
        'flex flex-col rounded-panel border border-line bg-surface p-5 shadow-raised',
        className,
      )}
    >
      <h2
        id="leitura-erpia-title"
        className="flex items-center gap-1.5 text-base font-semibold text-ink"
      >
        Leitura da <Marca />
        <Faisca />
      </h2>
      {analysis.resumo && (
        <p
          id="leitura-erpia-resumo"
          className={cn(
            'mt-2 text-sm leading-relaxed text-ink',
            !expanded && 'line-clamp-3 2xl:line-clamp-5',
          )}
        >
          {analysis.resumo}
        </p>
      )}
      {visiveis.length > 0 && (
        <ul id="leitura-erpia-sinais" className="mt-3 space-y-2 border-t border-line pt-3">
          {visiveis.map((sinal) => (
            <li key={`${sinal.label}-${sinal.text}`} className="flex gap-2.5 text-sm">
              <span
                aria-hidden
                className={cn(
                  'mt-[7px] size-1.5 shrink-0 rounded-full',
                  sinal.tone === 'positive' ? 'bg-positive' : 'bg-warning',
                )}
              />
              <p className="min-w-0 text-ink-muted">
                <span
                  className={cn(
                    'font-medium',
                    sinal.tone === 'positive' ? 'text-positive' : 'text-warning',
                  )}
                >
                  {sinal.label}:
                </span>{' '}
                {sinal.text}
              </p>
            </li>
          ))}
        </ul>
      )}
      {(temMais || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="leitura-erpia-resumo leitura-erpia-sinais"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        >
          {expanded ? 'Mostrar menos' : 'Ler análise completa'}
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')}
          />
        </button>
      )}

      {offer && (
        <div className="mt-auto pt-4">
          <div className="rounded-control border border-credit-line bg-credit-soft p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-credit-ink">
              <Faisca label={null} />
              Oportunidade de crédito
            </p>
            <p className="mt-1.5 text-sm text-ink">{offer.headline}</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="inline-block rounded-full bg-credit px-2 py-0.5 text-2xs font-medium text-[#0f1310]">
                  Pré-aprovado
                </span>
                <p className="mt-1">
                  <Money value={offer.valor} size="lg" className="text-ink" />
                </p>
                <p className="tabular text-xs text-ink-muted">
                  {PRODUTO_LABEL[offer.oportunidade.tipo]} ·{' '}
                  {pct(offer.oportunidade.taxa_mensal, 2)} a.m. ·{' '}
                  {prazo(offer.oportunidade.prazo_max_meses)}
                </p>
              </div>
              <ButtonLink
                to={simulatorHref(offer.oportunidade.tipo, offer.valor)}
                variant="primary"
                size="sm"
                aria-label={`Simular ${PRODUTO_LABEL[offer.oportunidade.tipo].toLowerCase()}`}
              >
                Simular
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
      {rodape && (
        <p className={cn('truncate text-xs text-ink-faint', offer ? 'mt-3' : 'mt-auto pt-3')}>
          {rodape}
        </p>
      )}
    </section>
  )
}
