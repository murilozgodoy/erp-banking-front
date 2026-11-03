/** Ícones desenhados para a landing: traço 1,75 em grade 20×20, herdando currentColor. */

import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-5 shrink-0'}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </Icon>
  )
}

export function PixIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 17.5 10 10 17.5 2.5 10z" />
      <path d="M6.5 10h7" />
    </Icon>
  )
}

export function BarcodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 5v10M6 5v10M9 5v10M12.5 5v10M15 5v10M17 5v10" />
    </Icon>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" />
    </Icon>
  )
}
