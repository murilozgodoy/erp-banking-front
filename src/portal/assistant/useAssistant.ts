import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage, retryAfterSeconds } from '@/lib/errors'

import { usePortalApi } from '../api'
import type { Acao, AssistantMessage, AssistantRequest, AssistantResponse, Fonte } from '../types'

/** Limites do contrato (seção 9). */
export const MAX_MESSAGES = 20
export const MAX_CHARS = 2000
export const MAX_ROTA = 300

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

function load(key: string): ChatEntry[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

function save(key: string, entries: ChatEntry[]) {
  try {
    if (entries.length) sessionStorage.setItem(key, JSON.stringify(entries))
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
  entries: ChatEntry[]
  /** Pergunta em andamento (ainda sem resposta) ou que falhou. */
  pendingQuestion: string | null
  pending: boolean
  failure: AssistantFailure | null
  /** 429 com `Retry-After`: instante (ms) até quando o envio fica bloqueado. */
  blockedUntil: number | null
  /** Id da resposta que acabou de chegar (para o micro-momento de conclusão). */
  freshId: string | null
  send: (question: string) => void
  retry: () => void
  reset: () => void
}

/**
 * Conversa com o assistente: histórico na sessionStorage (por `sub`), envio pela Score API
 * (`POST /me/assistant/messages`) e estado de erro com nova tentativa. A pergunta só entra no
 * histórico junto com a resposta, para que um erro não deixe duas perguntas seguidas.
 */
export function useAssistant({ sub, rota }: { sub?: string; rota: string }): AssistantChat {
  const api = usePortalApi()
  const key = storageKey(sub)
  const [state, setState] = useState(() => ({ key, entries: load(key) }))
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [failure, setFailure] = useState<AssistantFailure | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  // Troca de usuário: recarrega o histórico da nova chave (ajuste durante o render).
  if (state.key !== key) setState({ key, entries: load(key) })
  const entries = state.entries
  // Conversa descartada ("Nova conversa") enquanto a resposta ainda vinha: ignora o resultado.
  const generation = useRef(0)

  useEffect(() => save(state.key, state.entries), [state])

  const mutation = useMutation({
    mutationFn: (request: AssistantRequest) => api.score.assistant(request),
  })

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim().slice(0, MAX_CHARS)
      if (!question || mutation.isPending) return
      if (blockedUntil !== null && Date.now() < blockedUntil) return
      const run = generation.current
      setPendingQuestion(question)
      setFailure(null)
      setFreshId(null)
      mutation.mutate(
        { messages: toApiMessages(entries, question), rota: rota.slice(0, MAX_ROTA) },
        {
          onSuccess: (response: AssistantResponse) => {
            if (run !== generation.current) return
            const answerId = newId()
            setState((current) => ({
              ...current,
              entries: [
                ...current.entries,
                { id: newId(), role: 'user', content: question },
                {
                  id: answerId,
                  role: 'assistant',
                  content: response.resposta,
                  fontes: response.fontes ?? [],
                  acoes: response.acoes ?? [],
                  sugestoes: response.sugestoes ?? [],
                },
              ],
            }))
            setPendingQuestion(null)
            setFreshId(answerId)
          },
          onError: (error) => {
            if (run !== generation.current) return
            const failed = classify(error)
            setFailure(failed)
            if (failed.kind === 'limite' && failed.retryAfter) {
              setBlockedUntil(Date.now() + failed.retryAfter * 1000)
            }
          },
        },
      )
    },
    [blockedUntil, entries, mutation, rota],
  )

  const retry = useCallback(() => {
    if (pendingQuestion) send(pendingQuestion)
  }, [pendingQuestion, send])

  const reset = useCallback(() => {
    generation.current += 1
    mutation.reset()
    setState((current) => ({ ...current, entries: [] }))
    setPendingQuestion(null)
    setFailure(null)
    setFreshId(null)
    setBlockedUntil(null)
  }, [mutation])

  return {
    entries,
    pendingQuestion,
    pending: mutation.isPending,
    failure,
    blockedUntil,
    freshId,
    send,
    retry,
    reset,
  }
}
