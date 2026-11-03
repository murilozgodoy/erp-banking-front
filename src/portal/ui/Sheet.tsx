import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/**
 * Painel lateral modal para tarefas focadas (pagar, antecipar, revisar). Em portal, com foco
 * preso, Esc para fechar e retorno do foco ao gatilho.
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  // `onClose` costuma vir inline: guardado em ref, um novo render do pai não refaz o efeito
  // (que devolveria o foco ao gatilho e o puxaria de volta para o primeiro campo).
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !panel.current) return
      const focusables = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco inicial: [data-autofocus], senão o primeiro campo, senão o botão de fechar.
    requestAnimationFrame(() => {
      const root = panel.current
      const target =
        root?.querySelector<HTMLElement>('[data-autofocus]') ??
        root?.querySelector<HTMLElement>('input:not([disabled]),select,textarea') ??
        root?.querySelector<HTMLElement>('button')
      target?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="portal fixed inset-0 z-50 flex justify-end bg-transparent">
          <motion.div
            key="scrim"
            aria-hidden
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[#0b1415]/45"
          />
          <motion.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-overlay"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
