import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

import type { BusinessAnalysis } from '../../types'

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

interface Signal {
  tone: 'positive' | 'warning'
  label: string
  text: string
}

/** Até 3 sinais: pontos fortes primeiro, depois o que pede atenção (pelo menos um de cada). */
function readingSignals(analysis: BusinessAnalysis): Signal[] {
  const fortes = analysis.pontos_fortes.map((text): Signal => ({
    tone: 'positive',
    label: 'Ponto forte',
    text,
  }))
  const riscos = analysis.riscos.map((text): Signal => ({
    tone: 'warning',
    label: 'Atenção',
    text,
  }))
  // Com riscos: até 2 pontos fortes + 1 atenção; sem riscos ou sem fortes, completa com o outro.
  const nFortes = Math.min(fortes.length, riscos.length > 0 ? 2 : 3)
  return [...fortes.slice(0, nFortes), ...riscos].slice(0, 3)
}

/**
 * "Leitura da ErpIa": o resumo da análise do negócio com os sinais que o sustentam. Fica no
 * topo da coluna direita da Visão geral, acima das oportunidades de crédito.
 */
export function ReadingPanel({
  analysis,
  className,
}: {
  analysis: BusinessAnalysis
  className?: string
}) {
  const signals = readingSignals(analysis)
  const rodape = footer(analysis)
  return (
    <section
      aria-labelledby="leitura-erpia-title"
      className={cn('rounded-panel border border-line bg-surface p-5 shadow-raised', className)}
    >
      <h2
        id="leitura-erpia-title"
        className="flex items-center gap-1.5 text-base font-semibold text-ink"
      >
        Leitura da ErpIa
        <Faisca />
      </h2>
      {analysis.resumo && (
        <p className="mt-2 text-sm leading-relaxed text-ink">{analysis.resumo}</p>
      )}
      {signals.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
          {signals.map((signal) => (
            <li key={`${signal.label}-${signal.text}`} className="flex gap-2.5 text-sm">
              <span
                aria-hidden
                className={cn(
                  'mt-[7px] size-1.5 shrink-0 rounded-full',
                  signal.tone === 'positive' ? 'bg-positive' : 'bg-warning',
                )}
              />
              <p className="min-w-0 text-ink-muted">
                <span
                  className={cn(
                    'font-medium',
                    signal.tone === 'positive' ? 'text-positive' : 'text-warning',
                  )}
                >
                  {signal.label}:
                </span>{' '}
                {signal.text}
              </p>
            </li>
          ))}
        </ul>
      )}
      {rodape && <p className="mt-4 text-xs text-ink-faint">{rodape}</p>}
    </section>
  )
}
