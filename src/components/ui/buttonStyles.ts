const variants = {
  primary: 'bg-indigo-700 text-white hover:bg-indigo-800 disabled:bg-indigo-300',
  secondary:
    'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

export type ButtonVariant = keyof typeof variants

/** Classes compartilhadas por `Button` e `ButtonLink`. */
export function buttonClass(variant: ButtonVariant, extra = ''): string {
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${extra}`.trim()
}
