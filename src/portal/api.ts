import { useAuth0 } from '@auth0/auth0-react'
import type { AxiosInstance } from 'axios'
import { useMemo } from 'react'

import { env } from '@/config/env'
import { createHttpClient, type AccessTokenGetter } from '@/services/http'

import type {
  AssistantReply,
  AssistantRequest,
  BusinessAnalysis,
  ConversationDetail,
  ConversationSummary,
  CreditOffer,
  CreditRequestInput,
  GroupBy,
  InventoryReport,
  InviteRequest,
  InviteResponse,
  Me,
  OnboardingDraft,
  OnboardingPayload,
  OnboardingTemplate,
  Overview,
  PayablesReport,
  Payment,
  PaymentRequest,
  PaymentResponse,
  Pendencia,
  PortalCreditRequest,
  ReceivablesReport,
  ReceivableStatus,
  ReviewDecision,
  ReviewDecisionResult,
  ReviewItem,
  SalesReport,
  Simulation,
  SimulationRequest,
  StatementEntry,
  TeamMember,
  TeamMemberPatch,
} from './types'

/** Remove chaves vazias para não mandar `?from=&to=` às APIs. */
function params<T extends object>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

async function data<T>(request: Promise<{ data: T }>): Promise<T> {
  return (await request).data
}

export interface Period {
  from?: string
  to?: string
}

function onboardingPortal(http: AxiosInstance) {
  return {
    templates: () => data<OnboardingTemplate[]>(http.get('/onboarding/templates')),
    me: () => data<Me>(http.get('/me')),
    draft: () => data<OnboardingDraft>(http.get('/me/onboarding')),
    saveDraft: (payload: OnboardingPayload) =>
      data<OnboardingDraft>(http.put('/me/onboarding', payload)),
    team: () => data<TeamMember[]>(http.get('/me/team')),
    invite: (invite: InviteRequest) => data<InviteResponse>(http.post('/me/team/invites', invite)),
    updateMember: (id: number, patch: TeamMemberPatch) =>
      data<TeamMember>(http.patch(`/me/team/${id}`, patch)),
    removeMember: (id: number) => http.delete(`/me/team/${id}`).then(() => undefined),
    acceptInvite: (token: string) =>
      data<TeamMember>(http.post(`/me/team/invites/${encodeURIComponent(token)}/accept`)),
    reviews: (status = 'ANALISE_MANUAL') =>
      data<ReviewItem[]>(http.get('/onboarding/reviews', { params: { status } })),
    decide: (customerId: number, decision: ReviewDecision) =>
      data<ReviewDecisionResult>(http.post(`/onboarding/reviews/${customerId}/decision`, decision)),
  }
}

/**
 * O assistente pode levar até 45 s no back (tool use + modelo): o timeout padrão do client
 * cortaria a resposta no meio.
 */
export const ASSISTANT_TIMEOUT_MS = 50_000

function scorePortal(http: AxiosInstance) {
  return {
    myAnalysis: () => data<BusinessAnalysis>(http.get('/me/analysis')),
    analysisOf: (customerId: number) =>
      data<BusinessAnalysis>(http.get(`/scores/analyses/${customerId}`)),
    /** Assistente ErpIa (seções 9 e 10): resposta inteira, sem streaming, já salva na conversa. */
    assistant: (request: AssistantRequest) =>
      data<AssistantReply>(
        http.post('/me/assistant/messages', request, { timeout: ASSISTANT_TIMEOUT_MS }),
      ),
    conversations: (query: { limit?: number; offset?: number } = {}) =>
      data<ConversationSummary[]>(http.get('/me/assistant/conversations', { params: query })),
    conversation: (id: string) =>
      data<ConversationDetail>(http.get(`/me/assistant/conversations/${encodeURIComponent(id)}`)),
    deleteConversation: async (id: string) => {
      await http.delete(`/me/assistant/conversations/${encodeURIComponent(id)}`)
    },
    deleteConversations: async () => {
      await http.delete('/me/assistant/conversations')
    },
  }
}

function transactionsPortal(http: AxiosInstance) {
  return {
    overview: () => data<Overview>(http.get('/me/overview')),
    sales: (query: Period & { group_by?: GroupBy } = {}) =>
      data<SalesReport>(http.get('/me/sales', { params: params(query) })),
    receivables: (query: Period & { status?: ReceivableStatus } = {}) =>
      data<ReceivablesReport>(http.get('/me/receivables', { params: params(query) })),
    payables: (query: { status?: string } = {}) =>
      data<PayablesReport>(http.get('/me/payables', { params: params(query) })),
    pay: (payment: PaymentRequest) => data<PaymentResponse>(http.post('/me/payments', payment)),
    payments: () => data<Payment[]>(http.get('/me/payments')),
    pendingPayments: () => data<Payment[]>(http.get('/me/payments/pending')),
    /** Aprovar debita (ou agenda) e responde como o `POST /me/payments`, com comprovante. */
    approvePayment: (id: number) => data<PaymentResponse>(http.post(`/me/payments/${id}/approve`)),
    rejectPayment: (id: number, motivo?: string) =>
      data<Payment>(http.post(`/me/payments/${id}/reject`, motivo ? { motivo } : {})),
    statement: (query: Period = {}) =>
      data<StatementEntry[]>(http.get('/me/statement', { params: params(query) })),
    inventory: () => data<InventoryReport>(http.get('/me/inventory')),
    pendencias: () => data<Pendencia[]>(http.get('/me/pendencias')),
    simulate: (simulation: SimulationRequest) =>
      data<Simulation>(http.post('/me/credit/simulations', simulation)),
    offers: () => data<CreditOffer[]>(http.get('/me/credit/offers')),
    requestCredit: (input: CreditRequestInput) =>
      data<PortalCreditRequest>(http.post('/me/credit/requests', input)),
    creditRequests: () => data<PortalCreditRequest[]>(http.get('/me/credit/requests')),
    /** Contrata uma proposta AGUARDANDO_CONTRATACAO (`contratar_credito`). */
    confirmCreditRequest: (id: number) =>
      data<PortalCreditRequest>(http.post(`/me/credit/requests/${id}/confirm`)),
  }
}

/** Services do portal (rotas `/me` das 3 APIs), autenticados com o token do cliente. */
export function createPortalApi(getAccessToken: AccessTokenGetter) {
  return {
    onboarding: onboardingPortal(createHttpClient(env.onboardingApiUrl, getAccessToken)),
    score: scorePortal(createHttpClient(env.scoreApiUrl, getAccessToken)),
    erp: transactionsPortal(createHttpClient(env.transactionsApiUrl, getAccessToken)),
  }
}

export type PortalApi = ReturnType<typeof createPortalApi>

/** `createPortalApi` com o access token do usuário logado. */
export function usePortalApi(): PortalApi {
  const { getAccessTokenSilently } = useAuth0()
  return useMemo(
    () =>
      createPortalApi(async () => {
        const token = await getAccessTokenSilently()
        if (!token) throw new Error('Access token indisponível. Entre novamente.')
        return token
      }),
    [getAccessTokenSilently],
  )
}
