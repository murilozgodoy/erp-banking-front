import { moneyParts } from '../lib/format'
import { cn } from '@/lib/cn'

interface MoneyProps {
  value: number
  /** Tamanho tipográfico: os centavos ficam um degrau menores e mais claros. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'display'
  /** Colore pelo sinal (entrada/saída). */
  signed?: boolean
  className?: string
}

const sizes = {
  sm: ['text-sm', 'text-xs'],
  md: ['text-base', 'text-sm'],
  lg: ['text-xl', 'text-base'],
  xl: ['text-3xl tracking-[-0.02em]', 'text-xl'],
  display: ['text-4xl tracking-[-0.03em]', 'text-2xl'],
} as const

/**
 * Valor em BRL com tabular-nums e centavos rebaixados: o olho lê os reais primeiro. O texto
 * acessível é o valor completo, numa única leitura.
 */
export function Money({ value, size = 'md', signed = false, className }: MoneyProps) {
  const { sign, reais, centavos } = moneyParts(value)
  const [main, cents] = sizes[size]
  const tone = signed ? (value < 0 ? 'text-negative' : value > 0 ? 'text-positive' : '') : ''
  const plus = signed && value > 0 ? '+' : ''
  return (
    <span className={cn('tabular font-semibold whitespace-nowrap', main, tone, className)}>
      <span aria-hidden>
        {plus}
        {sign}
        {reais}
        <span className={cn(cents, 'font-medium opacity-60')}>,{centavos}</span>
      </span>
      <span className="sr-only">
        {plus}
        {sign}
        {reais},{centavos}
      </span>
    </span>
  )
}
