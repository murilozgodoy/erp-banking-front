import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Texto do título (nome acessível do diálogo); aceita `<Marca/>` e ícones decorativos. */
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Ações do cabeçalho, antes do botão de fechar. */
  actions?: ReactNode
  /** `md` = 512 px (padrão); `sm` = 420 px. Abaixo disso, tela cheia. */
  size?: 'sm' | 'md'
}

/**
 * Painel lateral modal para tarefas focadas (pagar, antecipar, revisar). Em portal, com foco
 * preso, Esc para fechar e retorno do foco ao gatilho.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  actions,
  size = 'md',
}: SheetProps) {
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
            className={cn(
              'relative flex h-full w-full flex-col border-l border-line bg-surface shadow-overlay',
              size === 'sm'
                ? 'max-w-[420px] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
                : 'max-w-lg',
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {actions}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="grid size-8 place-items-center rounded-control text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:size-11"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
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
