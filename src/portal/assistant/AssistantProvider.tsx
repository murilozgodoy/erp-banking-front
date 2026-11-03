import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

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
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const chat = useAssistant({ sub: user?.sub, rota: pathname })

  const openAssistant = useCallback((options?: OpenAssistantOptions) => {
    if (options?.prefill) setDraft(options.prefill.slice(0, MAX_CHARS))
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((value) => !value), [])

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
    () => ({ open, openAssistant, close, toggle, rota: pathname, chat, draft, setDraft }),
    [open, openAssistant, close, toggle, pathname, chat, draft],
  )

  return (
    <AssistantContext.Provider value={value}>
      {children}
      <AssistantLauncher variant="fab" />
      <AssistantSheet />
    </AssistantContext.Provider>
  )
}
