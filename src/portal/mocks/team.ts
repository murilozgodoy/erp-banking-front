import { PAPEIS, PERMISSOES } from '../team/permissions'
import type {
  AcceptInviteResponse,
  InviteRequest,
  InviteResponse,
  MembroResumo,
  Papel,
  Permissao,
  TeamMember,
  TeamMemberPatch,
} from '../types'

/**
 * Equipe da empresa no mock (seção 11, contrato final do Onboarding). O membro logado é o DONO
 * por padrão; para ver o portal como outro papel, use `?membro=admin|financeiro|operador|leitura`
 * (fica salvo no navegador).
 *
 * Erros como no back: `{error: CODIGO}` (o front traduz o código) e 422 com `campos`.
 */

const CHAVE = 'erp-portal-membro'
const PAPEL_DA_URL: Record<string, Papel> = {
  dono: 'DONO',
  admin: 'ADMIN',
  financeiro: 'FINANCEIRO',
  operador: 'OPERADOR',
  leitura: 'LEITURA',
}
/** O mesmo `CUSTOMER_ID` do `db.ts` (a Aurora Pães). */
const EMPRESA_ID = 1042
const DIA = 86_400_000

type Registro = TeamMember & { token: string | null }

let equipe: Registro[] | null = null
let seq = 10
let logado: Papel | null = null

function iso(dias: number): string {
  return new Date(Date.now() + dias * DIA).toISOString()
}

function inicial(): Registro[] {
  const base = { convite_expira_em: null, token: null }
  return [
    {
      ...base,
      id: 1,
      nome: 'Marina Costa',
      email: 'marina@aurorapaes.com.br',
      papel: 'DONO',
      permissoes: [...PERMISSOES],
      limite_pagamento: null,
      status: 'ATIVO',
      created_at: iso(-120),
      updated_at: iso(-120),
    },
    {
      ...base,
      id: 2,
      nome: 'Rafael Lima',
      email: 'financeiro@aurorapaes.com.br',
      papel: 'FINANCEIRO',
      permissoes: [...PAPEIS.FINANCEIRO.permissoes],
      limite_pagamento: 20_000,
      status: 'ATIVO',
      created_at: iso(-60),
      updated_at: iso(-60),
    },
    {
      ...base,
      id: 3,
      nome: 'Júlia Santos',
      email: 'compras@aurorapaes.com.br',
      papel: 'OPERADOR',
      permissoes: [...PAPEIS.OPERADOR.permissoes],
      limite_pagamento: 2_000,
      status: 'ATIVO',
      created_at: iso(-30),
      updated_at: iso(-30),
    },
    {
      id: 4,
      nome: 'Carlos Mendes',
      email: 'contador@escritoriomendes.com.br',
      papel: 'LEITURA',
      permissoes: [...PAPEIS.LEITURA.permissoes],
      limite_pagamento: null,
      status: 'CONVIDADO',
      created_at: iso(-2),
      updated_at: iso(-2),
      convite_expira_em: iso(5),
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
    created_at: iso(-10),
    updated_at: iso(-10),
    convite_expira_em: null,
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

/** O DONO primeiro, depois na ordem de entrada (como o back). */
export function listar(): TeamMember[] {
  return [...registros()]
    .sort((a, b) => Number(b.papel === 'DONO') - Number(a.papel === 'DONO') || a.id - b.id)
    .map(semToken)
}

export type ResultadoEquipe<T> =
  { tipo: 'ok'; valor: T } | { tipo: 'erro'; http: number; corpo: Record<string, unknown> }

function erro<T>(http: number, codigo: string, extra: Record<string, unknown> = {}) {
  return { tipo: 'erro', http, corpo: { error: codigo, ...extra } } as ResultadoEquipe<T>
}

function invalido<T>(campos: Record<string, string>) {
  return erro<T>(422, 'validation_failed', { campos })
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAPEIS_CONVIDAVEIS: Papel[] = ['ADMIN', 'FINANCEIRO', 'OPERADOR', 'LEITURA']
const SEM_LIMITE_PERMITIDO: Papel[] = ['DONO', 'ADMIN']

function permissoesValidas(lista: unknown): lista is Permissao[] {
  return Array.isArray(lista) && lista.every((p) => PERMISSOES.includes(p as Permissao))
}

/** Quem não é DONO só concede o que tem: a primeira permissão que falta, se houver. */
function alemDoQueTem(permissoes: Permissao[]): Permissao | undefined {
  const autor = membroAtual()
  if (autor.papel === 'DONO') return undefined
  return permissoes.find((p) => !autor.permissoes.includes(p))
}

/** Pagar sem limite só para DONO/ADMIN; o limite, quando há, é positivo. */
function erroDeLimite(
  papel: Papel,
  permissoes: Permissao[],
  limite: number | null | undefined,
): string | undefined {
  if (limite !== undefined && limite !== null && !(limite > 0)) {
    return 'O limite precisa ser maior que zero.'
  }
  if (permissoes.includes('pagar') && !SEM_LIMITE_PERMITIDO.includes(papel) && limite == null) {
    return 'Defina um limite de pagamento para quem pode pagar.'
  }
  return undefined
}

export function convidar(req: Partial<InviteRequest>): ResultadoEquipe<InviteResponse> {
  const campos: Record<string, string> = {}
  if (!req.nome?.trim()) campos.nome = 'Informe o nome.'
  if (!req.email || !EMAIL.test(req.email.trim())) campos.email = 'Informe um e-mail válido.'
  if (!req.papel || !PAPEIS_CONVIDAVEIS.includes(req.papel)) {
    campos.papel = 'Escolha Administrador, Financeiro, Operador ou Leitura.'
  }
  if (req.permissoes !== undefined && !permissoesValidas(req.permissoes)) {
    campos.permissoes = 'Permissão desconhecida.'
  }
  if (!campos.papel && !campos.permissoes) {
    const permissoes = req.permissoes ?? PAPEIS[req.papel!].permissoes
    const limite = erroDeLimite(req.papel!, permissoes, req.limite_pagamento)
    if (limite) campos.limite_pagamento = limite
  }
  if (Object.keys(campos).length) return invalido(campos)

  const papel = req.papel!
  const permissoes = req.permissoes ? [...req.permissoes] : [...PAPEIS[papel].permissoes]
  const falta = alemDoQueTem(papel === 'ADMIN' ? [...PERMISSOES] : permissoes)
  if (falta) return erro(403, 'SEM_PERMISSAO', { permissao: falta })

  const email = req.email!.trim().toLowerCase()
  const existente = registros().find((m) => m.email === email)
  if (existente?.status === 'CONVIDADO') return erro(409, 'CONVITE_PENDENTE')
  if (existente) return erro(409, 'EMAIL_JA_CADASTRADO')

  const token = `convite-${seq}-${Math.random().toString(36).slice(2, 10)}`
  const agora = new Date().toISOString()
  const registro: Registro = {
    id: seq++,
    nome: req.nome!.trim(),
    email,
    papel,
    permissoes,
    limite_pagamento: req.limite_pagamento ?? null,
    status: 'CONVIDADO',
    created_at: agora,
    updated_at: agora,
    convite_expira_em: iso(7),
    token,
  }
  registros().push(registro)
  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    tipo: 'ok',
    valor: { membro: semToken(registro), convite_url: `${origem}/convite/${token}` },
  }
}

/** Regras comuns de PATCH e DELETE: existe, não é o DONO, não é a própria pessoa. */
function alvo(id: number): ResultadoEquipe<Registro> {
  const registro = registros().find((m) => m.id === id)
  if (!registro) return erro(404, 'MEMBRO_NAO_ENCONTRADO')
  if (registro.papel === 'DONO') return erro(403, 'DONO_PROTEGIDO')
  if (registro.id === membroAtual().id) return erro(403, 'AUTO_EDICAO')
  return { tipo: 'ok', valor: registro }
}

export function atualizar(
  id: number,
  patch: Partial<TeamMemberPatch>,
): ResultadoEquipe<TeamMember> {
  const encontrado = alvo(id)
  if (encontrado.tipo === 'erro') return encontrado
  const registro = encontrado.valor
  if (patch.papel === 'DONO') return erro(409, 'DONO_UNICO')
  if (patch.papel !== undefined && !PAPEIS_CONVIDAVEIS.includes(patch.papel)) {
    return invalido({ papel: 'Papel desconhecido.' })
  }
  if (patch.permissoes !== undefined && !permissoesValidas(patch.permissoes)) {
    return invalido({ permissoes: 'Permissão desconhecida.' })
  }
  const papel = patch.papel ?? registro.papel
  const permissoes =
    patch.permissoes ?? (patch.papel ? PAPEIS[patch.papel].permissoes : registro.permissoes)
  const limite =
    patch.limite_pagamento !== undefined ? patch.limite_pagamento : registro.limite_pagamento
  const erroLimite = erroDeLimite(papel, permissoes, limite)
  if (erroLimite) return invalido({ limite_pagamento: erroLimite })
  const novas = permissoes.filter((p) => !registro.permissoes.includes(p))
  const falta = alemDoQueTem(papel === 'ADMIN' ? [...PERMISSOES] : novas)
  if (falta) return erro(403, 'SEM_PERMISSAO', { permissao: falta })

  registro.papel = papel
  registro.permissoes = [...permissoes]
  registro.limite_pagamento = limite
  if (patch.status && registro.status !== 'CONVIDADO') registro.status = patch.status
  registro.updated_at = new Date().toISOString()
  return { tipo: 'ok', valor: semToken(registro) }
}

/** Remove o membro ou revoga o convite pendente (204). */
export function remover(id: number): ResultadoEquipe<null> {
  const encontrado = alvo(id)
  if (encontrado.tipo === 'erro') return encontrado
  const lista = registros()
  lista.splice(lista.indexOf(encontrado.valor), 1)
  return { tipo: 'ok', valor: null }
}

export function aceitar(token: string): ResultadoEquipe<AcceptInviteResponse> {
  // Tokens de demonstração dos erros do contrato.
  if (token === 'convite-expirado') return erro(410, 'CONVITE_EXPIRADO')
  if (token === 'convite-outra-empresa') return erro(409, 'JA_VINCULADO')
  const registro = registros().find((m) => m.token === token)
  if (!registro) return erro(404, 'CONVITE_NAO_ENCONTRADO')
  if (registro.convite_expira_em && new Date(registro.convite_expira_em) < new Date()) {
    return erro(410, 'CONVITE_EXPIRADO')
  }
  registro.status = 'ATIVO'
  registro.token = null
  registro.convite_expira_em = null
  registro.updated_at = new Date().toISOString()
  return { tipo: 'ok', valor: { customer_id: EMPRESA_ID, membro: semToken(registro) } }
}
