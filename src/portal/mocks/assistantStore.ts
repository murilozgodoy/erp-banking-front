import type { ConversationDetail, ConversationSummary, StoredMessage } from '../types'

/**
 * Conversas do assistente no mock (seção 10), por usuário (`sub` do token). Ficam em memória e
 * são espelhadas no localStorage para a conversa sobreviver ao recarregar no `npm run dev`.
 */

interface Conversa {
  id: string
  titulo: string
  updated_at: string
  mensagens: StoredMessage[]
}

const STORAGE_KEY = 'erp-portal-mock-assistente'

let porUsuario: Record<string, Conversa[]> = carregar()
let proximoId = 1 + Math.max(0, ...Object.values(porUsuario).flatMap((c) => ids(c)))

function ids(conversas: Conversa[]) {
  return conversas.flatMap((c) => c.mensagens.map((m) => m.id))
}

function carregar(): Record<string, Conversa[]> {
  try {
    const bruto = globalThis.localStorage?.getItem(STORAGE_KEY)
    const dados: unknown = bruto ? JSON.parse(bruto) : null
    return dados && typeof dados === 'object' ? (dados as Record<string, Conversa[]>) : {}
  } catch {
    return {}
  }
}

let ultimo = 0
/** Instantes sempre crescentes: a ordem da lista não depende de duas escritas no mesmo ms. */
function agora() {
  ultimo = Math.max(Date.now(), ultimo + 1)
  return new Date(ultimo).toISOString()
}

function salvar() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(porUsuario))
  } catch {
    // Sem localStorage: o mock segue só em memória.
  }
}

/** Apaga todas as conversas de todos os usuários (início de cada teste). */
export function resetConversas() {
  porUsuario = {}
  proximoId = 1
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // idem
  }
}

/** `sub` do `Authorization: Bearer <jwt>` (o mock não valida a assinatura). */
export function usuarioDo(request: Request): string {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  try {
    const payload = token.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    if (typeof sub === 'string' && sub) return sub
  } catch {
    // token opaco ou ausente
  }
  return token || 'anonimo'
}

function doUsuario(sub: string) {
  porUsuario[sub] ??= []
  return porUsuario[sub]
}

function tituloDe(pergunta: string) {
  const linha = pergunta.replace(/\s+/g, ' ').trim()
  return linha.length > 80 ? `${linha.slice(0, 79)}…` : linha
}

export function listar(sub: string, limit: number, offset: number): ConversationSummary[] {
  return [...doUsuario(sub)]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(offset, offset + limit)
    .map(({ id, titulo, updated_at, mensagens }) => ({
      id,
      titulo,
      updated_at,
      mensagens: mensagens.length,
    }))
}

export function buscar(sub: string, id: string): ConversationDetail | null {
  const conversa = doUsuario(sub).find((c) => c.id === id)
  return conversa
    ? { id: conversa.id, titulo: conversa.titulo, mensagens: conversa.mensagens }
    : null
}

export function criar(sub: string, pergunta: string): Conversa {
  const conversa: Conversa = {
    id: crypto.randomUUID(),
    titulo: tituloDe(pergunta),
    updated_at: agora(),
    mensagens: [],
  }
  doUsuario(sub).push(conversa)
  salvar()
  return conversa
}

export function adicionar(
  sub: string,
  id: string,
  mensagem: Omit<StoredMessage, 'id' | 'created_at'>,
): StoredMessage {
  const conversa = doUsuario(sub).find((c) => c.id === id)
  if (!conversa) throw new Error(`Conversa ${id} não existe.`)
  const quando = agora()
  const salva: StoredMessage = { ...mensagem, id: proximoId++, created_at: quando }
  conversa.mensagens.push(salva)
  conversa.updated_at = quando
  salvar()
  return salva
}

export function apagar(sub: string, id: string): boolean {
  const conversas = doUsuario(sub)
  const antes = conversas.length
  porUsuario[sub] = conversas.filter((c) => c.id !== id)
  salvar()
  return porUsuario[sub].length < antes
}

export function apagarTodas(sub: string) {
  porUsuario[sub] = []
  salvar()
}
