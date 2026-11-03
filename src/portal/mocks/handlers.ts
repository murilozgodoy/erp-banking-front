import { delay, http, HttpResponse, type HttpHandler } from 'msw'

import { env } from '@/config/env'

import type {
  InventoryMovementInput,
  InviteRequest,
  OnboardingPayload,
  PaymentRequest,
  Permissao,
  ReviewDecision,
  SimulationRequest,
  TeamMemberPatch,
} from '../types'
import { assistantHandlers } from './assistant'
import * as db from './db'
import * as team from './team'
import { TEMPLATES } from './templates'

/** Latência realista no navegador; sem espera nos testes. */
async function latencia() {
  if (import.meta.env.MODE !== 'test') await delay(250)
}

async function corpo<T>(request: Request): Promise<Partial<T>> {
  try {
    const json: unknown = await request.json()
    return json && typeof json === 'object' ? (json as Partial<T>) : {}
  } catch {
    return {}
  }
}

function naoEncontrado(detail: string) {
  return HttpResponse.json({ detail }, { status: 404 })
}

function semPermissao(permissao: Permissao) {
  return HttpResponse.json({ error: 'SEM_PERMISSAO', permissao }, { status: 403 })
}

/**
 * Rotas `/me` do Transactions: só com o onboarding aprovado e, quando indicado, com a permissão
 * do membro logado (403 `SEM_PERMISSAO`, seção 11).
 */
function protegido(
  resolver: (request: Request, params: Record<string, string>) => Promise<Response> | Response,
  permissao: Permissao | null = 'ver_financeiro',
) {
  return async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
    await latencia()
    if (!db.onboardingAprovado()) {
      return HttpResponse.json(
        { error: 'ONBOARDING_PENDENTE', status: db.me().onboarding_status },
        { status: 409 },
      )
    }
    if (permissao && !team.pode(permissao)) return semPermissao(permissao)
    return resolver(request, params as Record<string, string>)
  }
}

function resultadoEquipe<T>(resultado: team.ResultadoEquipe<T>, status = 200) {
  return resultado.tipo === 'ok'
    ? resultado.valor === null
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json(resultado.valor, { status })
    : HttpResponse.json(resultado.corpo, { status: resultado.http })
}

function teamHandlers(base: string): HttpHandler[] {
  const gestor =
    (
      resolver: (request: Request, params: Record<string, string>) => Promise<Response> | Response,
    ) =>
    async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      await latencia()
      if (!team.pode('gerenciar_equipe')) return semPermissao('gerenciar_equipe')
      return resolver(request, params as Record<string, string>)
    }
  return [
    http.get(
      `${base}/me/team`,
      gestor(() => HttpResponse.json(team.listar())),
    ),
    http.post(`${base}/me/team/invites/:token/accept`, async ({ params }) => {
      await latencia()
      return resultadoEquipe(team.aceitar(String(params.token)))
    }),
    http.post(
      `${base}/me/team/invites`,
      gestor(async (request) =>
        resultadoEquipe(team.convidar(await corpo<InviteRequest>(request)), 201),
      ),
    ),
    http.patch(
      `${base}/me/team/:id`,
      gestor(async (request, params) =>
        resultadoEquipe(team.atualizar(Number(params.id), await corpo<TeamMemberPatch>(request))),
      ),
    ),
    http.delete(
      `${base}/me/team/:id`,
      gestor((_, params) => resultadoEquipe(team.remover(Number(params.id)))),
    ),
  ]
}

const DATA = /^\d{4}-\d{2}-\d{2}$/

function dataReal(valor: string): boolean {
  if (!DATA.test(valor)) return false
  const data = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor)
}

interface Regras {
  status?: string[]
  /** Aceita vários status separados por vírgula. */
  statusLista?: boolean
  groupBy?: boolean
}

type Query = {
  from: string | null
  to: string | null
  status: string | null
  group_by: string | null
}

/** Lê e valida os filtros; `string` = mensagem do 400 PARAMETRO_INVALIDO. */
function query(request: Request, regras: Regras = {}): Query | string {
  const params = new URL(request.url).searchParams
  const q: Query = {
    from: params.get('from'),
    to: params.get('to'),
    status: params.get('status'),
    group_by: params.get('group_by'),
  }
  for (const chave of ['from', 'to'] as const) {
    const valor = q[chave]
    if (valor && !dataReal(valor)) return `${chave} deve ser uma data yyyy-MM-dd.`
  }
  if (q.from && q.to && q.from > q.to) return 'from deve ser anterior a to.'
  if (regras.groupBy && q.group_by && !['day', 'week', 'month'].includes(q.group_by)) {
    return 'group_by deve ser day, week ou month.'
  }
  if (regras.status && q.status) {
    const valores = regras.statusLista ? q.status.split(',') : [q.status]
    if (!valores.every((v) => regras.status?.includes(v.trim().toUpperCase()))) {
      return `status deve ser ${regras.status.join(', ')}.`
    }
  }
  return q
}

/** Responde 400 se os filtros forem inválidos; senão chama `resposta`. */
function comQuery(regras: Regras, resposta: (q: Query) => unknown) {
  return (request: Request) => {
    const q = query(request, regras)
    if (typeof q === 'string') {
      return HttpResponse.json({ error: 'PARAMETRO_INVALIDO', mensagem: q }, { status: 400 })
    }
    return HttpResponse.json(resposta(q) as Record<string, unknown>)
  }
}

function respostaErro(resultado: db.ErroApi) {
  return HttpResponse.json(resultado.body, { status: resultado.http })
}

function onboardingHandlers(base: string): HttpHandler[] {
  return [
    http.get(`${base}/onboarding/templates`, async () => {
      await latencia()
      return HttpResponse.json(TEMPLATES)
    }),
    http.get(`${base}/me`, async () => {
      await latencia()
      return HttpResponse.json(db.me())
    }),
    http.get(`${base}/me/onboarding`, async () => {
      await latencia()
      return HttpResponse.json(db.rascunho())
    }),
    http.put(`${base}/me/onboarding`, async ({ request }) => {
      await latencia()
      // Só o DONO edita o cadastro (seção 11).
      if (team.membroAtual().papel !== 'DONO') {
        return HttpResponse.json({ error: 'SEM_PERMISSAO', permissao: 'dono' }, { status: 403 })
      }
      const resultado = db.salvarOnboarding(await corpo<OnboardingPayload>(request))
      if (resultado.tipo === 'conflito') {
        return HttpResponse.json({ detail: resultado.detail }, { status: 409 })
      }
      if (resultado.tipo === 'invalido') {
        return HttpResponse.json(
          { detail: 'Preencha os campos obrigatórios.', campos: resultado.erros },
          { status: 422 },
        )
      }
      return HttpResponse.json(resultado.draft)
    }),
    http.get(`${base}/onboarding/reviews`, async ({ request }) => {
      await latencia()
      const status = new URL(request.url).searchParams.get('status') ?? 'ANALISE_MANUAL'
      return HttpResponse.json(db.reviews(status))
    }),
    http.post(`${base}/onboarding/reviews/:id/decision`, async ({ request, params }) => {
      await latencia()
      const decisao = await corpo<ReviewDecision>(request)
      if (decisao.decisao !== 'APROVADO' && decisao.decisao !== 'REPROVADO') {
        return HttpResponse.json([{ campo: 'decisao', erro: 'Use APROVADO ou REPROVADO.' }], {
          status: 422,
        })
      }
      const resultado = db.decidir(Number(params.id), {
        decisao: decisao.decisao,
        comentario: typeof decisao.comentario === 'string' ? decisao.comentario : '',
      })
      if (resultado.tipo === 'nao_encontrado') return naoEncontrado('Cliente não encontrado.')
      if (resultado.tipo === 'conflito') {
        return HttpResponse.json({ detail: resultado.detail }, { status: 409 })
      }
      return HttpResponse.json(resultado.resultado)
    }),
  ]
}

function analiseNaoEncontrada() {
  return HttpResponse.json({ error: 'ANALISE_NAO_ENCONTRADA' }, { status: 404 })
}

function scoreHandlers(base: string): HttpHandler[] {
  return [
    http.get(`${base}/me/analysis`, async () => {
      await latencia()
      if (db.me().onboarding_status === 'NAO_INICIADO') {
        return HttpResponse.json({ error: 'ONBOARDING_NAO_INICIADO' }, { status: 404 })
      }
      const analise = db.analiseAtual()
      return analise ? HttpResponse.json(analise) : analiseNaoEncontrada()
    }),
    http.get(`${base}/scores/analyses/:id`, async ({ params }) => {
      await latencia()
      const analise = db.analiseDe(Number(params.id))
      return analise ? HttpResponse.json(analise) : analiseNaoEncontrada()
    }),
  ]
}

function transactionsHandlers(base: string): HttpHandler[] {
  return [
    http.get(
      `${base}/me/overview`,
      protegido(() => HttpResponse.json(db.overview())),
    ),
    http.get(`${base}/me/sales`, protegido(comQuery({ groupBy: true }, (q) => db.vendas(q)))),
    http.get(
      `${base}/me/receivables`,
      protegido(
        comQuery({ status: ['PREVISTO', 'RECEBIDO', 'ANTECIPADO'] }, (q) => db.recebiveis(q)),
      ),
    ),
    http.get(
      `${base}/me/payables`,
      protegido(
        comQuery({ status: ['ABERTO', 'PAGO', 'ATRASADO', 'AGENDADO'], statusLista: true }, (q) =>
          db.contas(q.status),
        ),
      ),
    ),
    http.post(
      `${base}/me/payments`,
      protegido(async (request) => {
        const resultado = db.pagar(await corpo<PaymentRequest>(request))
        return resultado.tipo === 'ok'
          ? HttpResponse.json(resultado.resposta, { status: 201 })
          : respostaErro(resultado)
      }, 'pagar'),
    ),
    http.get(
      `${base}/me/payments/pending`,
      protegido(() => HttpResponse.json(db.pagamentosPendentes()), 'aprovar_pagamentos'),
    ),
    ...(['approve', 'reject'] as const).map((decisao) =>
      http.post(
        `${base}/me/payments/:id/${decisao}`,
        protegido(async (request, params) => {
          const motivo =
            decisao === 'reject' ? (await corpo<{ motivo?: string }>(request)).motivo : undefined
          const resultado = db.decidirPagamento(Number(params.id), decisao, motivo)
          if (resultado.tipo !== 'ok') return respostaErro(resultado)
          // Aprovar responde como o POST /me/payments (com comprovante); rejeitar, o pagamento.
          return HttpResponse.json(resultado.resposta ?? resultado.pagamento)
        }, 'aprovar_pagamentos'),
      ),
    ),
    http.get(
      `${base}/me/payments`,
      protegido(() => HttpResponse.json(db.pagamentos())),
    ),
    http.get(`${base}/me/statement`, protegido(comQuery({}, (q) => db.extrato(q)))),
    http.get(
      `${base}/me/inventory`,
      protegido(() => HttpResponse.json(db.estoque())),
    ),
    http.post(
      `${base}/me/inventory/:id/movements`,
      protegido(async (request, params) => {
        const resultado = db.movimentarEstoque(
          Number(params.id),
          await corpo<InventoryMovementInput>(request),
        )
        return resultado.tipo === 'ok'
          ? HttpResponse.json(resultado.resposta, { status: 201 })
          : respostaErro(resultado)
      }, 'gerenciar_estoque'),
    ),
    http.get(
      `${base}/me/inventory/:id/movements`,
      protegido((_, params) => {
        const lista = db.movimentosEstoque(Number(params.id))
        return lista
          ? HttpResponse.json(lista)
          : HttpResponse.json(
              { error: 'ITEM_NAO_ENCONTRADO', message: 'Item de estoque não encontrado' },
              { status: 404 },
            )
      }),
    ),
    http.get(
      `${base}/me/pendencias`,
      protegido(() => HttpResponse.json(db.pendencias())),
    ),
    http.post(
      `${base}/me/credit/simulations`,
      protegido(async (request) => {
        const resultado = db.simularCredito(await corpo<SimulationRequest>(request))
        return resultado.tipo === 'ok'
          ? HttpResponse.json(resultado.simulation, { status: 201 })
          : respostaErro(resultado)
      }, 'pedir_credito'),
    ),
    http.get(
      `${base}/me/credit/offers`,
      protegido(() => HttpResponse.json(db.ofertas())),
    ),
    http.post(
      `${base}/me/credit/requests`,
      protegido(async (request) => {
        // Contratar exige contratar_credito; quem só pede deixa a proposta aguardando.
        if (!team.pode('contratar_credito') && !team.pode('pedir_credito')) {
          return semPermissao('contratar_credito')
        }
        const resultado = db.solicitarCredito(await corpo<db.SolicitacaoInput>(request))
        return resultado.tipo === 'ok'
          ? HttpResponse.json(resultado.request, { status: 201 })
          : respostaErro(resultado)
      }, null),
    ),
    http.post(
      `${base}/me/credit/requests/:id/confirm`,
      protegido((_, params) => {
        const resultado = db.confirmarCredito(Number(params.id))
        return resultado.tipo === 'ok'
          ? HttpResponse.json(resultado.request)
          : respostaErro(resultado)
      }, 'contratar_credito'),
    ),
    http.get(
      `${base}/me/credit/requests`,
      protegido(() => HttpResponse.json(db.propostas())),
    ),
  ]
}

/** Todas as rotas do portal (Onboarding, Score e Transactions) sobre o banco em memória. */
export function createHandlers(): HttpHandler[] {
  return [
    ...onboardingHandlers(env.onboardingApiUrl),
    ...teamHandlers(env.onboardingApiUrl),
    ...scoreHandlers(env.scoreApiUrl),
    ...transactionsHandlers(env.transactionsApiUrl),
    ...assistantHandlers(env.scoreApiUrl),
  ]
}
