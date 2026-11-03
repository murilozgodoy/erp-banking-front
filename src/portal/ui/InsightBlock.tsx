import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Faisca } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { AskAssistant } from '../assistant/AskAssistant'
import { money, pct } from '../lib/format'
import type { Insight, InsightSeveridade, ProdutoCredito } from '../types'

import { GatedButton, GatedButtonLink } from './Gated'
import { PRODUTO_LABEL, simulatorHref } from './credit'
import { useTypewriter } from './useTypewriter'

const severity: Record<
  InsightSeveridade,
  { icon: ReactNode; label: string; tone: string; halo: string; spins: boolean }
> = {
  info: {
    icon: <Info className="size-4" />,
    label: 'Leitura',
    tone: 'text-info bg-info-soft',
    halo: 'bg-info-soft',
    spins: false,
  },
  atencao: {
    icon: <AlertTriangle className="size-4" />,
    label: 'Atenção',
    tone: 'text-warning bg-warning-soft',
    halo: 'bg-warning-soft',
    spins: false,
  },
  oportunidade: {
    icon: <Faisca label={null} className="size-4" />,
    label: 'Oportunidade',
    tone: 'bg-credit-soft',
    halo: 'bg-credit-soft',
    spins: true,
  },
}

/**
 * Selo da IA à esquerda do insight: enquanto a mensagem é digitada, o halo pulsa de leve e a
 * Faísca gira 90°; o ícone de alerta só pulsa. Para quando a digitação termina.
 */
function InsightBadge({
  sev,
  typing,
}: {
  sev: (typeof severity)[InsightSeveridade]
  typing: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden className="relative grid size-9 shrink-0 place-items-center">
      <motion.span
        className={cn('absolute inset-0 rounded-full', sev.halo)}
        animate={typing ? { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] } : { scale: 1, opacity: 1 }}
        transition={
          typing ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
        }
      />
      <span className={cn('relative grid size-9 place-items-center rounded-full', sev.tone)}>
        <motion.span
          className="grid place-items-center"
          initial={reduce || !sev.spins ? false : { rotate: 0 }}
          animate={{ rotate: sev.spins ? 90 : 0 }}
          transition={{ duration: 1.2, ease: 'linear' }}
        >
          {sev.icon}
        </motion.span>
      </span>
    </span>
  )
}

/**
 * Mensagem com efeito de digitação. A altura final fica reservada (o resto do texto ocupa o
 * espaço, invisível); leitores de tela recebem o texto inteiro de uma vez, não letra a letra.
 */
function TypedText({
  text,
  shown,
  done,
  className,
}: {
  text: string
  shown: number
  done: boolean
  className?: string
}) {
  const [caret, setCaret] = useState(true)
  useEffect(() => {
    if (!done) return
    // O cursor pisca 2 vezes e some.
    const timer = window.setTimeout(() => setCaret(false), 1100)
    return () => window.clearTimeout(timer)
  }, [done])
  if (done && !caret) return <p className={className}>{text}</p>
  return (
    <p className={className}>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      {/* Parte digitada e resto (invisível, reserva a altura) via CSS `content`, para o texto
          existir uma vez só no DOM (o sr-only acima). */}
      <span aria-hidden>
        <span data-text={text.slice(0, shown)} className="before:content-[attr(data-text)]" />
        <span className="insight-caret" />
        <span
          data-text={text.slice(shown)}
          className="invisible before:content-[attr(data-text)]"
        />
      </span>
    </p>
  )
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
  /**
   * Mostra "Perguntar à ErpIa sobre isso" (abre o assistente com a pergunta pré-preenchida).
   * Só aparece dentro do portal (com o `AssistantProvider`). Padrão: `true`.
   */
  askAssistant?: boolean
}

/**
 * Bloco de IA de cada aba: o insight ligado à oferta de crédito que o resolve, marcado pela
 * Faísca (DESIGN.md). O lado esquerdo diz o que está acontecendo; o lado lima, como resolver.
 */
export function InsightBlock({
  insight,
  offer,
  className,
  askAssistant = true,
}: InsightBlockProps) {
  const reduce = useReducedMotion()
  const typing = useTypewriter(insight?.texto ?? '')
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
        // Centralizado na altura do card (o lado da oferta costuma ser mais alto).
        <div className="flex items-center gap-3.5 p-4 sm:p-5">
          <InsightBadge sev={sev} typing={!typing.done} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              <span className="sr-only">{sev.label}: </span>
              {insight.titulo}
            </p>
            <TypedText
              text={insight.texto}
              shown={typing.shown}
              done={typing.done}
              className={cn(
                'mt-1 max-w-[70ch]',
                offer ? 'text-base leading-relaxed text-ink' : 'text-sm text-ink-muted',
              )}
            />
            {askAssistant && <AskAssistant titulo={insight.titulo} texto={insight.texto} />}
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
            <div className="self-start">
              <GatedButton
                permissao="pedir_credito"
                variant="credit"
                size="sm"
                onClick={offer.onAction}
              >
                {offer.cta ?? 'Simular'}
                <ArrowRight aria-hidden className="size-4" />
              </GatedButton>
            </div>
          ) : (
            <div className="self-start">
              <GatedButtonLink
                permissao="pedir_credito"
                to={simulatorHref(offer.produto, offer.valor)}
                variant="credit"
                size="sm"
              >
                {offer.cta ?? 'Simular'}
                <ArrowRight aria-hidden className="size-4" />
              </GatedButtonLink>
            </div>
          )}
        </div>
      )}
    </motion.aside>
  )
}
