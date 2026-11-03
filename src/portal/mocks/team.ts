import { PAPEIS, PERMISSOES } from '../team/permissions'
import type {
  InviteRequest,
  InviteResponse,
  MembroResumo,
  Papel,
  Permissao,
  TeamMember,
  TeamMemberPatch,
} from '../types'

/**
 * Equipe da empresa no mock (seção 11). O membro logado é o DONO por padrão; para ver o portal
 * como outro papel, use `?membro=admin|financeiro|operador|leitura` (fica salvo no navegador).
 */

const CHAVE = 'erp-portal-membro'
const PAPEL_DA_URL: Record<string, Papel> = {
  dono: 'DONO',
  admin: 'ADMIN',
  financeiro: 'FINANCEIRO',
  operador: 'OPERADOR',
  leitura: 'LEITURA',
}

type Registro = TeamMember & { token: string | null }

let equipe: Registro[] | null = null
let seq = 10
let logado: Papel | null = null

function iso(diasAtras: number): string {
  return new Date(Date.now() - diasAtras * 86_400_000).toISOString()
}

function inicial(): Registro[] {
  return [
    {
      id: 1,
      nome: 'Marina Costa',
      email: 'marina@aurorapaes.com.br',
      papel: 'DONO',
      permissoes: [...PERMISSOES],
      limite_pagamento: null,
      status: 'ATIVO',
      created_at: iso(120),
      token: null,
    },
    {
      id: 2,
      nome: 'Rafael Lima',
      email: 'financeiro@aurorapaes.com.br',
      papel: 'FINANCEIRO',
      permissoes: [...PAPEIS.FINANCEIRO.permissoes],
      limite_pagamento: 20_000,
      status: 'ATIVO',
      created_at: iso(60),
      token: null,
    },
    {
      id: 3,
      nome: 'Júlia Santos',
      email: 'compras@aurorapaes.com.br',
      papel: 'OPERADOR',
      permissoes: [...PAPEIS.OPERADOR.permissoes],
      limite_pagamento: 2_000,
      status: 'ATIVO',
      created_at: iso(30),
      token: null,
    },
    {
      id: 4,
      nome: 'Carlos Mendes',
      email: 'contador@escritoriomendes.com.br',
      papel: 'LEITURA',
      permissoes: [...PAPEIS.LEITURA.permissoes],
      limite_pagamento: null,
      status: 'CONVIDADO',
      created_at: iso(2),
      invite_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      token: 'convite-demo-contador',
    },
  ]
}

function registros(): Registro[] {
  equipe ??= inicial()
  return equipe
}

function papelLogado(): Papel {
  if (logado) return logado
  let papel: Papel = 'DONO'
  try {
    const daUrl = new URLSearchParams(window.location.search).get('membro')?.toLowerCase()
    if (daUrl && PAPEL_DA_URL[daUrl]) localStorage.setItem(CHAVE, daUrl)
    const salvo = localStorage.getItem(CHAVE)
    if (salvo && PAPEL_DA_URL[salvo]) papel = PAPEL_DA_URL[salvo]
  } catch {
    // Sem storage/URL (testes): fica o DONO.
  }
  return papel
}

/** Troca o papel do membro logado (testes e barra de cenários). `null` volta ao padrão. */
export function setMembroLogado(papel: Papel | null) {
  logado = papel
}

export function resetTeam() {
  equipe = null
  seq = 10
  logado = null
}

/** O membro logado: o primeiro ATIVO do papel escolhido (ou um sintético com o preset). */
export function membroAtual(): TeamMember {
  const papel = papelLogado()
  const existente = registros().find((m) => m.papel === papel && m.status === 'ATIVO')
  if (existente) return semToken(existente)
  return {
    id: 99,
    nome: `Pessoa ${PAPEIS[papel].label}`,
    email: `${papel.toLowerCase()}@aurorapaes.com.br`,
    papel,
    permissoes: [...PAPEIS[papel].permissoes],
    limite_pagamento: papel === 'OPERADOR' ? 2_000 : null,
    status: 'ATIVO',
    created_at: iso(10),
  }
}

export function membroResumo(): MembroResumo {
  const { id, nome, email, papel, permissoes, limite_pagamento, status } = membroAtual()
  return { id, nome, email, papel, permissoes, limite_pagamento, status }
}

export function pode(permissao: Permissao): boolean {
  return membroAtual().permissoes.includes(permissao)
}

function semToken(registro: Registro | TeamMember): TeamMember {
  const { token: _token, ...membro } = registro as Registro
  void _token
  return membro
}

export function listar(): TeamMember[] {
  return registros().map(semToken)
}

export type ResultadoEquipe<T> =
  { tipo: 'ok'; valor: T } | { tipo: 'erro'; http: number; corpo: Record<string, unknown> }

function erro<T>(http: number, corpo: Record<string, unknown>): ResultadoEquipe<T> {
  return { tipo: 'erro', http, corpo }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAPEIS_CONVIDAVEIS: Papel[] = ['ADMIN', 'FINANCEIRO', 'OPERADOR', 'LEITURA']

function permissoesValidas(lista: unknown): lista is Permissao[] {
  return Array.isArray(lista) && lista.every((p) => PERMISSOES.includes(p as Permissao))
}

export function convidar(req: Partial<InviteRequest>): ResultadoEquipe<InviteResponse> {
  const campos: Record<string, string> = {}
  if (!req.nome?.trim()) campos.nome = 'Informe o nome.'
  if (!req.email || !EMAIL.test(req.email)) campos.email = 'Informe um e-mail válido.'
  if (!req.papel || !PAPEIS_CONVIDAVEIS.includes(req.papel)) {
    campos.papel = 'Escolha Administrador, Financeiro, Operador ou Leitura.'
  }
  if (req.permissoes !== undefined && !permissoesValidas(req.permissoes)) {
    campos.permissoes = 'Permissão desconhecida.'
  }
  if (
    req.limite_pagamento !== undefined &&
    req.limite_pagamento !== null &&
    !(req.limite_pagamento > 0)
  ) {
    campos.limite_pagamento = 'O limite precisa ser maior que zero (ou vazio para sem limite).'
  }
  if (Object.keys(campos).length) {
    return erro(400, { error: 'validation_failed', message: 'Dados inválidos.', campos })
  }
  const email = req.email!.trim().toLowerCase()
  if (registros().some((m) => m.email === email && m.status !== 'SUSPENSO')) {
    return erro(409, { error: 'MEMBRO_JA_EXISTE', message: 'Este e-mail já faz parte da equipe.' })
  }
  const papel = req.papel!
  const token = `convite-${seq}-${Math.random().toString(36).slice(2, 10)}`
  const registro: Registro = {
    id: seq++,
    nome: req.nome!.trim(),
    email,
    papel,
    permissoes: req.permissoes ? [...req.permissoes] : [...PAPEIS[papel].permissoes],
    limite_pagamento: req.limite_pagamento ?? null,
    status: 'CONVIDADO',
    created_at: new Date().toISOString(),
    invite_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    token,
  }
  registros().push(registro)
  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    tipo: 'ok',
    valor: { membro: semToken(registro), convite_url: `${origem}/convite/${token}` },
  }
}

export function atualizar(
  id: number,
  patch: Partial<TeamMemberPatch>,
): ResultadoEquipe<TeamMember> {
  const registro = registros().find((m) => m.id === id)
  if (!registro)
    return erro(404, { error: 'MEMBRO_NAO_ENCONTRADO', message: 'Pessoa não encontrada.' })
  if (registro.papel === 'DONO') {
    return erro(422, {
      error: 'DONO_IMUTAVEL',
      message: 'O dono não pode ser editado nem suspenso.',
    })
  }
  if (patch.papel === 'DONO') {
    return erro(422, { error: 'DONO_IMUTAVEL', message: 'Só existe um dono por empresa.' })
  }
  if (patch.permissoes !== undefined && !permissoesValidas(patch.permissoes)) {
    return erro(400, {
      error: 'validation_failed',
      message: 'Dados inválidos.',
      campos: { permissoes: 'Permissão desconhecida.' },
    })
  }
  if (patch.papel) {
    registro.papel = patch.papel
    if (patch.permissoes === undefined) registro.permissoes = [...PAPEIS[patch.papel].permissoes]
  }
  if (patch.permissoes) registro.permissoes = [...patch.permissoes]
  if (patch.limite_pagamento !== undefined) registro.limite_pagamento = patch.limite_pagamento
  if (patch.status) registro.status = patch.status
  registro.updated_at = new Date().toISOString()
  return { tipo: 'ok', valor: semToken(registro) }
}

export function remover(id: number): ResultadoEquipe<null> {
  const lista = registros()
  const registro = lista.find((m) => m.id === id)
  if (!registro)
    return erro(404, { error: 'MEMBRO_NAO_ENCONTRADO', message: 'Pessoa não encontrada.' })
  if (registro.papel === 'DONO') {
    return erro(422, { error: 'DONO_IMUTAVEL', message: 'O dono não pode ser removido.' })
  }
  lista.splice(lista.indexOf(registro), 1)
  return { tipo: 'ok', valor: null }
}

export function aceitar(token: string): ResultadoEquipe<TeamMember> {
  // Tokens de demonstração dos erros do contrato.
  if (token === 'convite-expirado') {
    return erro(410, { error: 'CONVITE_EXPIRADO', message: 'Este convite expirou.' })
  }
  if (token === 'convite-outra-empresa') {
    return erro(409, {
      error: 'JA_E_DE_OUTRA_EMPRESA',
      message: 'Este login já faz parte de outra empresa.',
    })
  }
  const registro = registros().find((m) => m.token === token)
  if (!registro) {
    return erro(404, { error: 'CONVITE_NAO_ENCONTRADO', message: 'Convite não encontrado.' })
  }
  if (registro.invite_expires_at && new Date(registro.invite_expires_at) < new Date()) {
    return erro(410, { error: 'CONVITE_EXPIRADO', message: 'Este convite expirou.' })
  }
  registro.status = 'ATIVO'
  registro.token = null
  registro.invite_expires_at = null
  return { tipo: 'ok', valor: semToken(registro) }
}
