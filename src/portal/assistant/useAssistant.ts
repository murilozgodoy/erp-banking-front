import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { errorMessage, retryAfterSeconds } from '@/lib/errors'

import { usePortalApi } from '../api'
import type { Acao, AssistantMessage, AssistantRequest, AssistantResponse, Fonte } from '../types'

/** Limites do contrato (seção 9). */
export const MAX_MESSAGES = 20
export const MAX_CHARS = 2000
export const MAX_ROTA = 300
/** Até quantas conversas ficam guardadas na sessão. */
export const MAX_CONVERSATIONS = 15

export type ChatEntry =
  | { id: string; role: 'user'; content: string }
  | {
      id: string
      role: 'assistant'
      content: string
      fontes: Fonte[]
      acoes: Acao[]
      sugestoes: string[]
    }

export type AssistantFailure =
  | { kind: 'indisponivel' }
  | { kind: 'limite'; retryAfter?: number }
  | { kind: 'onboarding' }
  | { kind: 'falha'; message: string }

export interface Conversation {
  id: string
  /** Primeira pergunta (até 80 caracteres). */
  titulo: string
  updated_at: string
  entries: ChatEntry[]
}

/** Item da lista "Conversas" (mesmo formato de `GET /me/assistant/conversations`). */
export interface ConversationSummary {
  id: string
  titulo: string
  updated_at: string
  mensagens: number
}

interface Store {
  conversations: Conversation[]
  currentId: string | null
}

const STORAGE_PREFIX = 'erpia-assistente'

export function storageKey(sub?: string) {
  return sub ? `${STORAGE_PREFIX}:${sub}` : STORAGE_PREFIX
}

function isEntry(value: unknown): value is ChatEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<ChatEntry>
  if (typeof entry.id !== 'string' || typeof entry.content !== 'string') return false
  if (entry.role === 'user') return true
  return (
    entry.role === 'assistant' &&
    Array.isArray(entry.fontes) &&
    Array.isArray(entry.acoes) &&
    Array.isArray(entry.sugestoes)
  )
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<Conversation>
  return (
    typeof c.id === 'string' &&
    typeof c.titulo === 'string' &&
    typeof c.updated_at === 'string' &&
    Array.isArray(c.entries)
  )
}

export function titleOf(question: string) {
  const line = question.replace(/\s+/g, ' ').trim()
  return line.length > 80 ? `${line.slice(0, 79)}…` : line
}

const EMPTY_STORE: Store = { conversations: [], currentId: null }

function load(key: string): Store {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    // Formato antigo: uma conversa só, como lista de mensagens.
    if (Array.isArray(parsed)) {
      const entries = parsed.filter(isEntry)
      if (!entries.length) return EMPTY_STORE
      const conversation: Conversation = {
        id: 'sessao',
        titulo: titleOf(entries[0].content),
        updated_at: new Date().toISOString(),
        entries,
      }
      return { conversations: [conversation], currentId: conversation.id }
    }
    const store = parsed as Partial<Store> | null
    const conversations = Array.isArray(store?.conversations)
      ? store.conversations
          .filter(isConversation)
          .map((c) => ({ ...c, entries: c.entries.filter(isEntry) }))
      : []
    const currentId =
      typeof store?.currentId === 'string' && conversations.some((c) => c.id === store.currentId)
        ? store.currentId
        : null
    return { conversations, currentId }
  } catch {
    return EMPTY_STORE
  }
}

function save(key: string, store: Store) {
  try {
    if (store.conversations.length) sessionStorage.setItem(key, JSON.stringify(store))
    else sessionStorage.removeItem(key)
  } catch {
    // sessionStorage indisponível (modo privado, cota): a conversa só não persiste.
  }
}

/**
 * Histórico enviado à API: as últimas 20 mensagens, começando por uma do usuário (cortar no
 * meio de um par deixaria uma resposta sem a pergunta).
 */
export function toApiMessages(entries: ChatEntry[], question: string): AssistantMessage[] {
  const messages: AssistantMessage[] = [
    ...entries.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: question },
  ]
  const trimmed = messages.slice(-MAX_MESSAGES)
  return trimmed[0]?.role === 'assistant' ? trimmed.slice(1) : trimmed
}

export function classify(error: unknown): AssistantFailure {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 503) return { kind: 'indisponivel' }
  if (status === 429) return { kind: 'limite', retryAfter: retryAfterSeconds(error) }
  if (status === 409) return { kind: 'onboarding' }
  return { kind: 'falha', message: errorMessage(error) }
}

let sequence = 0
function newId() {
  sequence += 1
  return `${Date.now().toString(36)}-${sequence}`
}

export interface AssistantChat {
  /** Conversa aberta (`null` = tela inicial). */
  currentId: string | null
  conversations: ConversationSummary[]
  entries: ChatEntry[]
  /** Pergunta em andamento (ainda sem resposta) ou que falhou, na conversa aberta. */
  pendingQuestion: string | null
  pending: boolean
  failure: AssistantFailure | null
  /** 429 com `Retry-After`: instante (ms) até quando o envio fica bloqueado. */
  blockedUntil: number | null
  /** Id da resposta que acabou de chegar (para o micro-momento de conclusão). */
  freshId: string | null
  send: (question: string) => void
  retry: () => void
  /** Volta à tela inicial; a conversa atual continua no histórico. */
  newConversation: () => void
  openConversation: (id: string) => void
  deleteConversation: (id: string) => void
  deleteAll: () => void
}

interface Pending {
  conversationId: string
  question: string
}

const EMPTY: ChatEntry[] = []

/**
 * Conversas com o assistente: histórico na sessionStorage (por `sub`, até 15 conversas), envio
 * pela Score API (`POST /me/assistant/messages`) e erro com nova tentativa. A pergunta só entra
 * na conversa junto com a resposta, para que um erro não deixe duas perguntas seguidas; a
 * resposta vai para a conversa em que foi feita, mesmo se o cliente trocar de conversa.
 */
export function useAssistant({ sub, rota }: { sub?: string; rota: string }): AssistantChat {
  const api = usePortalApi()
  const key = storageKey(sub)
  const [state, setState] = useState(() => ({ key, ...load(key) }))
  const [pending, setPending] = useState<Pending | null>(null)
  const [failure, setFailure] = useState<AssistantFailure | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  // Troca de usuário: recarrega o histórico da nova chave (ajuste durante o render).
  if (state.key !== key) setState({ key, ...load(key) })
  const current = state.conversations.find((c) => c.id === state.currentId)
  const entries = current?.entries ?? EMPTY
  const draftId = useRef<string | null>(null)

  useEffect(
    () => save(state.key, { conversations: state.conversations, currentId: state.currentId }),
    [state],
  )

  const mutation = useMutation({
    mutationFn: (request: AssistantRequest) => api.score.assistant(request),
  })

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim().slice(0, MAX_CHARS)
      if (!question || mutation.isPending) return
      if (blockedUntil !== null && Date.now() < blockedUntil) return
      // Pergunta da tela inicial abre uma conversa (que só entra na lista com a resposta).
      const conversationId = state.currentId ?? newId()
      draftId.current = current ? null : conversationId
      setPending({ conversationId, question })
      setFailure(null)
      setFreshId(null)
      if (!state.currentId) setState((s) => ({ ...s, currentId: conversationId }))
      mutation.mutate(
        { messages: toApiMessages(entries, question), rota: rota.slice(0, MAX_ROTA) },
        {
          onSuccess: (response: AssistantResponse) => {
            const answerId = newId()
            const now = new Date().toISOString()
            const novas: ChatEntry[] = [
              { id: newId(), role: 'user', content: question },
              {
                id: answerId,
                role: 'assistant',
                content: response.resposta,
                fontes: response.fontes ?? [],
                acoes: response.acoes ?? [],
                sugestoes: response.sugestoes ?? [],
              },
            ]
            setState((s) => {
              const existing = s.conversations.find((c) => c.id === conversationId)
              const updated: Conversation = existing
                ? { ...existing, updated_at: now, entries: [...existing.entries, ...novas] }
                : { id: conversationId, titulo: titleOf(question), updated_at: now, entries: novas }
              const others = s.conversations.filter((c) => c.id !== conversationId)
              return { ...s, conversations: [updated, ...others].slice(0, MAX_CONVERSATIONS) }
            })
            draftId.current = null
            setPending(null)
            setFreshId(answerId)
          },
          onError: (error) => {
            const failed = classify(error)
            setFailure(failed)
            if (failed.kind === 'limite' && failed.retryAfter) {
              setBlockedUntil(Date.now() + failed.retryAfter * 1000)
            }
          },
        },
      )
    },
    [blockedUntil, current, entries, mutation, rota, state.currentId],
  )

  const visible = pending && pending.conversationId === state.currentId ? pending : null

  const retry = useCallback(() => {
    if (visible) send(visible.question)
  }, [send, visible])

  const go = useCallback(
    (currentId: string | null) => {
      // A pergunta que falhou é descartada ao sair da conversa; a que está a caminho, não.
      if (!mutation.isPending) {
        setPending(null)
        setFailure(null)
      }
      setFreshId(null)
      setState((s) => ({ ...s, currentId }))
    },
    [mutation.isPending],
  )

  const newConversation = useCallback(() => go(null), [go])
  const openConversation = useCallback((id: string) => go(id), [go])

  const deleteConversation = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.filter((c) => c.id !== id),
      currentId: s.currentId === id ? null : s.currentId,
    }))
  }, [])

  const deleteAll = useCallback(() => {
    setState((s) => ({ ...s, conversations: [], currentId: null }))
    setFreshId(null)
  }, [])

  const conversations = useMemo(
    () =>
      state.conversations.map(({ id, titulo, updated_at, entries: list }) => ({
        id,
        titulo,
        updated_at,
        mensagens: list.length,
      })),
    [state.conversations],
  )

  return {
    currentId: state.currentId,
    conversations,
    entries,
    pendingQuestion: visible?.question ?? null,
    pending: mutation.isPending && !!visible,
    failure: visible ? failure : null,
    blockedUntil,
    freshId,
    send,
    retry,
    newConversation,
    openConversation,
    deleteConversation,
    deleteAll,
  }
}
