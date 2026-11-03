import { Lock } from 'lucide-react'

import { Faisca, Marca } from '@/components/brand/Logo'

import { LockedAction } from '../ui/Gated'

import { isMac, useAssistantContext } from './context'

const LABEL = 'Perguntar à ErpIa'

/**
 * Botão do assistente. `rail`: item destacado do rail (telas largas), com Faísca, rótulo e o
 * atalho; `fab`: botão flutuante de 56 px no canto inferior direito das telas estreitas, que some
 * com o painel aberto para não cobrir o campo de pergunta.
 */
export function AssistantLauncher({ variant = 'rail' }: { variant?: 'rail' | 'fab' }) {
  const { open, toggle, permitido } = useAssistantContext()
  const mac = isMac()
  // Sem `usar_assistente`: o botão flutuante some; o item do rail fica, travado, explicando.
  if (!permitido) return variant === 'fab' ? null : <LockedLauncher />
  const common = {
    type: 'button' as const,
    onClick: toggle,
    'aria-label': LABEL,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    'aria-keyshortcuts': mac ? 'Meta+K' : 'Control+K',
  }

  if (variant === 'fab') {
    return (
      <button
        {...common}
        hidden={open}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-overlay transition-transform duration-150 hover:bg-accent-hover active:scale-95 lg:hidden"
      >
        <Faisca label={null} className="size-6 fill-on-accent! [&_path]:stroke-transparent!" />
      </button>
    )
  }

  return (
    <button
      {...common}
      className="mb-1 hidden h-9 w-full items-center gap-3 rounded-control bg-rail-raised/60 px-3 text-sm font-medium text-rail-ink transition-colors duration-150 hover:bg-rail-raised lg:flex"
    >
      <Faisca label={null} className="size-[18px] fill-[#C6F24E]! [&_path]:stroke-transparent!" />
      <span aria-hidden className="flex-1 truncate text-left">
        Perguntar à <Marca />
      </span>
      <kbd aria-hidden className="font-sans text-2xs text-rail-muted">
        {mac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}

/** Item do rail para quem não tem `usar_assistente`: focável, com o cadeado e o motivo. */
function LockedLauncher() {
  return (
    <div className="mb-1 hidden lg:block">
      <LockedAction permissao="usar_assistente" className="w-full">
        {(describe) => (
          <button
            type="button"
            aria-disabled="true"
            {...describe}
            className="flex h-9 w-full cursor-not-allowed items-center gap-3 rounded-control px-3 text-sm font-medium text-rail-muted opacity-70"
          >
            <Faisca label={null} className="size-[18px] opacity-60" />
            <span aria-hidden className="flex-1 truncate text-left">
              Perguntar à <Marca />
            </span>
            <span className="sr-only">{LABEL}</span>
            <Lock aria-hidden className="size-3.5" />
          </button>
        )}
      </LockedAction>
    </div>
  )
}
