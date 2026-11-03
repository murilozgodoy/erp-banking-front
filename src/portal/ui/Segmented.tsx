import { motion } from 'motion/react'
import { useId } from 'react'

import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}

/** Controle segmentado (radiogroup) para filtros curtos: período, agrupamento, status. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  const layoutId = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-control border border-line bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
              if (!step) return
              event.preventDefault()
              const index = options.findIndex((o) => o.value === value)
              const next = options[(index + step + options.length) % options.length]
              onChange(next.value)
              const group = event.currentTarget.parentElement
              requestAnimationFrame(() =>
                group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(),
              )
            }}
            className={cn(
              'relative h-7 rounded-[5px] px-3 text-xs font-medium transition-colors duration-150',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
                className="absolute inset-0 rounded-[5px] bg-surface shadow-sm"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
