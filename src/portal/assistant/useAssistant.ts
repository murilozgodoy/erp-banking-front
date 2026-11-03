import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { errorMessage, retryAfterSeconds } from '@/lib/errors'

import { usePortalApi } from '../api'
import type {
  Acao,
  AssistantReply,
  AssistantRequest,
  ConversationDetail,
  Fonte,
  StoredMessage,
} from '../types'

/** Limites do contrato (seção 9). */
export const MAX_CHARS = 2000
export const MAX_ROTA = 300
/** Conversas por página da lista (`limit` de 1 a 100). */
export const PAGE_SIZE = 20

export const assistantKeys = {
  all: ['portal', 'assistant'] as const,
  conversations: ['portal', 'assistant', 'conversations'] as const,
  conversationAll: ['portal', 'assistant', 'conversation'] as const,
  conversation: (id: string) => ['portal', 'assistant', 'conversation', id] as const,
}

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
  | { kind: 'indisponivel'; conversationId?: string }
  | { kind: 'limite'; retryAfter?: number }
  | { kind: 'onboarding' }
  | { kind: 'permissao' }
  | { kind: 'perdida' }
  | { kind: 'falha'; message: string }

const STORAGE_PREFIX = 'erpia-assistente'

/** Chave do localStorage com o `conversation_id` da conversa aberta, por `sub`. */
export function storageKey(sub?: string) {
  return sub ? `${STORAGE_PREFIX}:${sub}` : STORAGE_PREFIX
}

function readStored(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return value && /^[\w-]{1,64}$/.test(value) ? value : null
  } catch {
    return null
  }
}

function writeStored(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id)
    else localStorage.removeItem(key)
  } catch {
    // localStorage indisponível (modo privado, cota): a conversa só não volta ao recarregar.
  }
}

export function titleOf(question: string) {
  const line = question.replace(/\s+/g, ' ').trim()
  return line.length > 80 ? `${line.slice(0, 79)}…` : line
}

function errorBody(error: unknown): Record<string, unknown> {
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
}

export function classify(error: unknown): AssistantFailure {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const body = errorBody(error)
  if (status === 503) {
    const id = body.conversation_id
    return typeof id === 'string' && id
      ? { kind: 'indisponivel', conversationId: id }
      : { kind: 'indisponivel' }
  }
  if (status === 429) return { kind: 'limite', retryAfter: retryAfterSeconds(error) }
  if (status === 409) return { kind: 'onboarding' }
  if (status === 404) return { kind: 'perdida' }
  if (status === 403 && body.error === 'SEM_PERMISSAO') return { kind: 'permissao' }
  return { kind: 'falha', message: errorMessage(error) }
}

function isNotFound(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404
}

export function toEntries(mensagens: StoredMessage[]): ChatEntry[] {
  return mensagens.map((m) =>
    m.role === 'user'
      ? { id: String(m.id), role: 'user', content: m.content }
      : {
          id: String(m.id),
          role: 'assistant',
          content: m.content,
          fontes: m.fontes ?? [],
          acoes: m.acoes ?? [],
          sugestoes: m.sugestoes ?? [],
        },
  )
}

/** Junta pergunta e resposta à conversa em cache, sem repetir a pergunta já salva por um 503. */
function appendTurn(
  old: ConversationDetail | undefined,
  question: string,
  reply: AssistantReply,
): ConversationDetail {
  const now = new Date().toISOString()
  const base = old ?? { id: reply.conversation_id, titulo: titleOf(question), mensagens: [] }
  const last = base.mensagens.at(-1)
  const saved = last?.role === 'user' && last.content === question
  const vazio = { fontes: [], acoes: [], sugestoes: [] }
  const mensagens: StoredMessage[] = [
    ...base.mensagens,
    ...(saved
      ? []
      : [
          {
            id: -reply.message_id,
            role: 'user' as const,
            content: question,
            ...vazio,
            created_at: now,
          },
        ]),
    {
      id: reply.message_id,
      role: 'assistant',
      content: reply.resposta,
      fontes: reply.fontes ?? [],
      acoes: reply.acoes ?? [],
      sugestoes: reply.sugestoes ?? [],
      created_at: now,
    },
  ]
  return { ...base, mensagens }
}

/** Conversa nova, ainda sem id no servidor (vira o `conversation_id` com a 1ª resposta). */
const DRAFT = 'novo:'
const isDraft = (id: string | null) => !!id?.startsWith(DRAFT)
let sequence = 0
function newDraft() {
  sequence += 1
  return `${DRAFT}${sequence}`
}

export interface AssistantChat {
  /** Conversa aberta (`null` = tela inicial). */
  currentId: string | null
  entries: ChatEntry[]
  /** Buscando a conversa aberta (ex. depois de recarregar a página). */
  loading: boolean
  /** Falha ao buscar a conversa aberta (o 404 volta à tela inicial). */
  loadError: string | null
  reload: () => void
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
  /** Apaga uma conversa no servidor (rejeita se falhar). */
  deleteConversation: (id: string) => Promise<void>
  deleteAll: () => Promise<void>
}

interface Pending {
  conversationId: string
  question: string
}

const EMPTY: ChatEntry[] = []

/**
 * Conversas com o assistente, guardadas no Score (seção 10): a aberta é buscada por
 * `GET /me/assistant/conversations/{id}` e o id dela fica no localStorage (por `sub`), para voltar
 * depois de recarregar a página. A pergunta só entra na conversa junto com a resposta, para que
 * um erro não deixe duas perguntas seguidas; a resposta vai para a conversa em que foi feita,
 * mesmo se o cliente trocar de conversa.
 */
export function useAssistant({ sub, rota }: { sub?: string; rota: string }): AssistantChat {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const key = storageKey(sub)
  const [state, setState] = useState(() => ({ key, currentId: readStored(key) }))
  const [pending, setPending] = useState<Pending | null>(null)
  const [failure, setFailure] = useState<AssistantFailure | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  // Troca de usuário: lê a conversa guardada da nova chave (ajuste durante o render).
  if (state.key !== key) setState({ key, currentId: readStored(key) })
  const { currentId } = state
  const savedId = currentId && !isDraft(currentId) ? currentId : null

  useEffect(() => writeStored(state.key, savedId), [state.key, savedId])

  const conversation = useQuery({
    queryKey: assistantKeys.conversation(savedId ?? ''),
    queryFn: () => api.score.conversation(savedId as string),
    enabled: savedId !== null,
    // O cache é atualizado a cada resposta: não precisa buscar de novo.
    staleTime: Infinity,
  })
  const lost = savedId !== null && isNotFound(conversation.error)

  // Conversa apagada ou de outro usuário: esquece o id e volta à tela inicial (no render).
  if (lost) setState((s) => (s.currentId === savedId ? { ...s, currentId: null } : s))

  const visible = pending && pending.conversationId === currentId ? pending : null
  const data = savedId ? conversation.data : undefined
  const entries = useMemo(() => {
    if (!data) return EMPTY
    const list = toEntries(data.mensagens)
    // Pergunta salva por um 503 e ainda sem resposta: aparece uma vez só, como pendente.
    const last = list.at(-1)
    return visible && last?.role === 'user' && last.content === visible.question
      ? list.slice(0, -1)
      : list
  }, [data, visible])

  const mutation = useMutation({
    mutationFn: (request: AssistantRequest) => api.score.assistant(request),
  })

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim().slice(0, MAX_CHARS)
      if (!question || mutation.isPending) return
      if (blockedUntil !== null && Date.now() < blockedUntil) return
      // Pergunta da tela inicial abre uma conversa (que só ganha id com a resposta).
      const target = currentId ?? newDraft()
      if (!currentId) setState((s) => ({ ...s, currentId: target }))
      setPending({ conversationId: target, question })
      setFailure(null)
      setFreshId(null)
      const moveTo = (id: string) => {
        setState((s) => (s.currentId === target ? { ...s, currentId: id } : s))
        setPending((p) => (p?.conversationId === target ? { ...p, conversationId: id } : p))
      }
      mutation.mutate(
        {
          ...(isDraft(target) ? {} : { conversation_id: target }),
          messages: [{ role: 'user', content: question }],
          rota: rota.slice(0, MAX_ROTA),
        },
        {
          onSuccess: (reply) => {
            queryClient.setQueryData<ConversationDetail>(
              assistantKeys.conversation(reply.conversation_id),
              (old) => appendTurn(old, question, reply),
            )
            setState((s) =>
              s.currentId === target ? { ...s, currentId: reply.conversation_id } : s,
            )
            setPending(null)
            setFreshId(String(reply.message_id))
            void queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
          },
          onError: (error) => {
            const failed = classify(error)
            if (failed.kind === 'perdida') {
              // A conversa não existe mais: a nova tentativa começa outra.
              queryClient.removeQueries({ queryKey: assistantKeys.conversation(target) })
              moveTo(newDraft())
              void queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
            } else if (failed.kind === 'indisponivel' && failed.conversationId) {
              // A pergunta ficou salva: "Tentar de novo" segue na mesma conversa.
              const id = failed.conversationId
              if (isDraft(target)) {
                queryClient.setQueryData<ConversationDetail>(assistantKeys.conversation(id), {
                  id,
                  titulo: titleOf(question),
                  mensagens: [],
                })
                moveTo(id)
              }
              void queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
            } else if (failed.kind === 'limite' && failed.retryAfter) {
              setBlockedUntil(Date.now() + failed.retryAfter * 1000)
            }
            setFailure(failed)
          },
        },
      )
    },
    [blockedUntil, currentId, mutation, queryClient, rota],
  )

  const retry = useCallback(() => {
    if (visible) send(visible.question)
  }, [send, visible])

  const go = useCallback(
    (id: string | null) => {
      // A pergunta que falhou é descartada ao sair da conversa; a que está a caminho, não.
      if (!mutation.isPending) {
        setPending(null)
        setFailure(null)
      }
      setFreshId(null)
      setState((s) => ({ ...s, currentId: id }))
    },
    [mutation.isPending],
  )

  const newConversation = useCallback(() => go(null), [go])
  const openConversation = useCallback((id: string) => go(id), [go])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.score.deleteConversation(id)
      } catch (error) {
        // 404: já não existe (ou não é deste usuário); some da lista do mesmo jeito.
        if (!isNotFound(error)) throw error
      }
      queryClient.removeQueries({ queryKey: assistantKeys.conversation(id) })
      setState((s) => (s.currentId === id ? { ...s, currentId: null } : s))
      await queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
    },
    [api, queryClient],
  )

  const deleteAll = useCallback(async () => {
    await api.score.deleteConversations()
    queryClient.removeQueries({ queryKey: assistantKeys.conversationAll })
    setState((s) => (s.currentId && !isDraft(s.currentId) ? { ...s, currentId: null } : s))
    setFreshId(null)
    await queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
  }, [api, queryClient])

  const reload = useCallback(() => void conversation.refetch(), [conversation])

  return {
    currentId,
    entries,
    loading: savedId !== null && conversation.isPending,
    loadError:
      savedId !== null && conversation.isError && !lost ? errorMessage(conversation.error) : null,
    reload,
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

/** Lista "Conversas" (`GET /me/assistant/conversations`), 20 por página, mais recentes primeiro. */
export function useConversationList(enabled: boolean) {
  const api = usePortalApi()
  return useInfiniteQuery({
    queryKey: assistantKeys.conversations,
    queryFn: ({ pageParam }) => api.score.conversations({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    enabled,
  })
}
