import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'credit' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent shadow-sm hover:bg-accent-hover active:translate-y-px disabled:bg-line-strong disabled:text-ink-muted',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-sunken hover:border-ink-faint active:translate-y-px',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  // Lima é preenchimento; o texto é tinta (12,5:1). Só para ações de crédito sugeridas pela IA.
  credit:
    'bg-credit text-[#0f1310] shadow-sm hover:brightness-95 active:translate-y-px dark:hover:brightness-110',
  danger: 'bg-negative text-white hover:brightness-110 active:translate-y-px dark:text-paper',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(
    'inline-flex select-none items-center justify-center rounded-control font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,transform,filter] duration-150 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
    variants[variant],
    sizes[size],
  )
}
