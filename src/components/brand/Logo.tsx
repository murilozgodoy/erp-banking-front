import { cn } from '@/lib/cn'

import { FAISCA_PATH, MARK_FILL, MARK_LINES, SERIF_I_PATH } from './geometry'

interface MarkProps {
  className?: string
  /** `dark` para fundos escuros (rail, modo escuro): grafite mais claro, como no logo-dark. */
  tone?: 'light' | 'dark'
  title?: string
}

/** Símbolo ErpIa: três linhas de razão contábil formando um "E", com a Faísca. */
export function ErpIaMark({ className, tone = 'light', title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="32" height="32" rx="9" fill={MARK_FILL[tone]} />
      {MARK_LINES.map((line) => (
        <rect key={line.y} x="8" y={line.y} width={line.width} height="3" rx="1.5" fill="#EEF2EC" />
      ))}
      <path d={FAISCA_PATH} fill="#C6F24E" />
    </svg>
  )
}

/**
 * "I" com serifas, do tamanho da altura de caixa do texto em volta (em `em`), apoiado na linha de
 * base. Só o logo usa: no resto da interface o nome continua sendo texto.
 */
function SerifI() {
  return (
    <svg
      viewBox="0 0 38 72"
      aria-hidden
      data-glyph="serif-i"
      className="mx-[0.045em] inline-block h-[0.72em] w-[0.38em] fill-current align-baseline"
    >
      <path d={SERIF_I_PATH} />
    </svg>
  )
}

/**
 * Logo (símbolo + "ErpIa"). O texto é HTML, na fonte da página, e herda os tokens: "Erp" em
 * tinta e "Ia" em esmeralda (lima no escuro). O "I" é desenhado com serifas (`SerifI`) para não
 * ler como "l". `onDark` para o rail.
 */
export function ErpIaLogo({
  className,
  onDark = false,
  size = 'md',
}: {
  className?: string
  onDark?: boolean
  size?: 'md' | 'lg'
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-2.5', className)}
      role="img"
      aria-label="ErpIa"
    >
      <ErpIaMark
        tone={onDark ? 'dark' : 'light'}
        className={size === 'lg' ? 'size-11' : 'size-8'}
      />
      <span
        aria-hidden
        className={cn(
          'font-semibold tracking-[-0.02em]',
          size === 'lg' ? 'text-3xl' : 'text-xl',
          onDark ? 'text-rail-ink' : 'text-ink',
        )}
      >
        Erp
        <span className={onDark ? 'text-[#C6F24E]' : 'text-accent dark:text-credit'}>
          <SerifI />a
        </span>
      </span>
    </span>
  )
}

/**
 * Faísca: marca só o que a ErpIa infere (insights, oportunidades de crédito, pré-aprovado).
 * Pequena, ao lado do título do bloco; nunca decoração solta. O rótulo acessível diz que é
 * uma inferência da IA.
 */
export function Faisca({
  className,
  label = 'Sugerido pela ErpIa',
}: {
  className?: string
  /** `null` quando o texto ao lado já diz que é da IA. */
  label?: string | null
}) {
  return (
    <svg
      viewBox="17.6 11.6 8 8.2"
      className={cn('inline-block size-3.5 shrink-0 fill-credit', className)}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <path
        d={FAISCA_PATH}
        className="stroke-credit-ink/40 dark:stroke-transparent"
        strokeWidth={0.35}
      />
    </svg>
  )
}
