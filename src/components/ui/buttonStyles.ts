const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover disabled:bg-accent/40',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-paper disabled:text-ink-faint',
  danger: 'bg-negative text-white dark:text-paper hover:bg-negative/90 disabled:bg-negative/40',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
}

export type ButtonVariant = keyof typeof variants

/** Classes compartilhadas por `Button` e `ButtonLink`. */
export function buttonClass(variant: ButtonVariant, extra = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${extra}`.trim()
}
