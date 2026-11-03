import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'

export interface MenuAction {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

/**
 * Botão "Ações" com menu (padrão WAI-ARIA menu button): Enter/Espaço/seta abrem, setas e
 * Home/End navegam, Esc fecha e devolve o foco. O menu é `position: fixed` num portal para não
 * ser cortado pela rolagem horizontal da tabela.
 */
export function RowMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items = () =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const place = () => {
      const rect = button.current!.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    const go = (next: number) => {
      event.preventDefault()
      list[(next + list.length) % list.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(index + 1)
    else if (event.key === 'ArrowUp') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(list.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') close(false)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'grid size-8 place-items-center rounded-control text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink pointer-coarse:size-11',
          open && 'bg-sunken text-ink',
        )}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            style={position ? { top: position.top, right: position.right } : undefined}
            className="fixed z-40 min-w-48 rounded-control border border-line bg-surface p-1 shadow-overlay"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  // Foco de volta no botão antes de abrir o painel: ele o devolve ao fechar.
                  close()
                  action.onSelect()
                }}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left text-sm outline-none pointer-coarse:h-11',
                  '[&_svg]:size-4 [&_svg]:shrink-0',
                  action.danger
                    ? 'text-negative hover:bg-negative-soft focus-visible:bg-negative-soft'
                    : 'text-ink hover:bg-sunken focus-visible:bg-sunken [&_svg]:text-ink-muted',
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
