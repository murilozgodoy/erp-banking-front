/** Classes compartilhadas da landing (só utilitários de token, para seguir o tema). */

export const container = 'mx-auto w-full max-w-6xl px-4 sm:px-6'

export const sectionTitle =
  'text-[clamp(1.875rem,1.2rem+2.6vw,2.875rem)] leading-[1.08] font-semibold tracking-[-0.028em] text-ink'

export const lead = 'text-lg leading-relaxed text-ink-muted'

const buttonBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-medium whitespace-nowrap transition-colors duration-150 ease-out-expo'

export const primaryButton = `${buttonBase} bg-accent text-on-accent hover:bg-accent-hover`

export const secondaryButton = `${buttonBase} border border-line-strong bg-surface text-ink hover:bg-sunken`

export const ease = [0.16, 1, 0.3, 1] as const
