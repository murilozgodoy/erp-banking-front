import { createContext, useContext } from 'react'

import type { AssistantChat } from './useAssistant'

export interface OpenAssistantOptions {
  /** Pergunta já escrita no campo (não é enviada sozinha). */
  prefill?: string
}

export interface AssistantContextValue {
  open: boolean
  openAssistant: (options?: OpenAssistantOptions) => void
  close: () => void
  toggle: () => void
  /** Tela atual (pathname), enviada como `rota` e usada nas sugestões. */
  rota: string
  chat: AssistantChat
  /** Texto do campo de pergunta (sobrevive ao fechar o painel). */
  draft: string
  setDraft: (draft: string) => void
  /** Primeiro nome do usuário, para a saudação (ou `undefined`). */
  firstName?: string
}

export const AssistantContext = createContext<AssistantContextValue | null>(null)

export function useAssistantContext(): AssistantContextValue {
  const value = useContext(AssistantContext)
  if (!value) throw new Error('useAssistantContext precisa de <AssistantProvider>.')
  return value
}

/** Mac usa ⌘; os demais, Ctrl. */
export function isMac(): boolean {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return /Mac|iPhone|iPad/i.test(nav?.platform || nav?.userAgent || '')
}
