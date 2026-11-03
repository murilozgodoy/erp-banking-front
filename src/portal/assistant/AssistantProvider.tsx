import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

import { useMembro } from '../team/useMembro'

import { AssistantLauncher } from './AssistantLauncher'
import { AssistantSheet } from './AssistantSheet'
import { AssistantContext, type AssistantContextValue, type OpenAssistantOptions } from './context'
import { MAX_CHARS, useAssistant } from './useAssistant'

/**
 * Assistente ErpIa no portal: estado do painel, atalho global Ctrl/⌘ + K (funciona também com
 * o foco num campo, como uma paleta de comandos), o botão flutuante das telas estreitas e a
 * conversa, que sobrevive ao fechar o painel.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth0()
  const { pathname } = useLocation()
  // Sem `usar_assistente` o back responde 403: o painel não abre e as entradas explicam por quê.
  const permitido = useMembro().pode('usar_assistente')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const chat = useAssistant({ sub: user?.sub, rota: pathname })
  const nome = (user?.given_name ?? user?.name)?.trim().split(/\s+/)[0]
  const firstName = nome && !nome.includes('@') ? nome : undefined

  const openAssistant = useCallback(
    (options?: OpenAssistantOptions) => {
      if (!permitido) return
      if (options?.prefill) setDraft(options.prefill.slice(0, MAX_CHARS))
      setOpen(true)
    },
    [permitido],
  )
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => {
    if (permitido) setOpen((value) => !value)
  }, [permitido])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
      if (event.altKey || event.shiftKey || event.repeat) return
      event.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])

  const value = useMemo<AssistantContextValue>(
    () => ({
      permitido,
      open: open && permitido,
      openAssistant,
      close,
      toggle,
      rota: pathname,
      chat,
      draft,
      setDraft,
      firstName,
    }),
    [permitido, open, openAssistant, close, toggle, pathname, chat, draft, firstName],
  )

  return (
    <AssistantContext.Provider value={value}>
      {children}
      <AssistantLauncher variant="fab" />
      <AssistantSheet />
    </AssistantContext.Provider>
  )
}
