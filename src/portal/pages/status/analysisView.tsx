import { AlertTriangle, Check } from 'lucide-react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import { Pill } from '../../ui/Pill'
import type { BusinessAnalysis, FaixaRisco } from '../../types'

import { FAIXA, scoreOf } from './analysis'

export function FaixaPill({ faixa }: { faixa: FaixaRisco | null | undefined }) {
  if (!faixa || !(faixa in FAIXA)) return null
  return <Pill tone={FAIXA[faixa].tone}>{FAIXA[faixa].label}</Pill>
}

/** Score grande e legível, com a escala e a faixa ao lado. */
export function ScoreFigure({
  analysis,
  size = 'lg',
}: {
  analysis: Pick<BusinessAnalysis, 'score' | 'faixa_risco'>
  size?: 'md' | 'lg'
}) {
  const score = scoreOf(analysis)
  if (score === null) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'tabular font-semibold tracking-[-0.02em] text-ink',
            size === 'lg' ? 'text-4xl' : 'text-2xl',
          )}
        >
          {score}
        </span>
        <span className="text-sm text-ink-muted">de 1000</span>
      </p>
      <FaixaPill faixa={analysis.faixa_risco} />
    </div>
  )
}

/** Título de bloco lido pela IA: a Faísca só aparece quando o texto veio do modelo. */
export function ReadingTitle({
  children,
  ai,
  as: Heading = 'h3',
  id,
}: {
  children: string
  ai: boolean
  as?: 'h2' | 'h3' | 'h4'
  id?: string
}) {
  return (
    <Heading id={id} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
      {children}
      {ai && <Faisca label="Escrito pela IA da ErpIa" />}
    </Heading>
  )
}

/** Pontos fortes e de atenção lado a lado, com ícone e texto (nunca só a cor). */
export function StrengthsAndRisks({
  pontos_fortes = [],
  riscos = [],
  ai,
}: {
  pontos_fortes?: string[]
  riscos?: string[]
  ai: boolean
}) {
  if (pontos_fortes.length === 0 && riscos.length === 0) return null
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {pontos_fortes.length > 0 && (
        <div className="space-y-2.5">
          <ReadingTitle ai={ai}>Pontos fortes</ReadingTitle>
          <ul className="space-y-2">
            {pontos_fortes.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {riscos.length > 0 && (
        <div className="space-y-2.5">
          <ReadingTitle ai={ai}>Pontos de atenção</ReadingTitle>
          <ul className="space-y-2">
            {riscos.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
