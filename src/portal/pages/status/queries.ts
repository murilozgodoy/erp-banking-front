import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { usePortalApi } from '../../api'
import { portalKeys } from '../../layout/queries'
import type { BusinessAnalysis, Me, OnboardingDraft, OnboardingStatus } from '../../types'

/** Enquanto a análise automática roda (segundos a um minuto). */
export const POLL_AUTOMATICA_MS = 4_000
/** Na análise manual a decisão leva horas: consulta mais espaçada. */
export const POLL_MANUAL_MS = 30_000

/**
 * Chaves próprias da página, debaixo das chaves do portal: invalidar `portalKeys.me` também as
 * renova. Ficam separadas para que o polling não mude o `useMe()` da porta antes da hora (o
 * momento de confirmação da aprovação precisa aparecer antes do redirecionamento).
 */
export const statusKeys = {
  me: [...portalKeys.me, 'status'] as const,
  analysis: [...portalKeys.analysis, 'status'] as const,
}

export function pollInterval(status: OnboardingStatus | undefined): number | false {
  if (status === 'EM_ANALISE') return POLL_AUTOMATICA_MS
  if (status === 'ANALISE_MANUAL') return POLL_MANUAL_MS
  return false
}

export type AnalysisMissing = 'ONBOARDING_NAO_INICIADO' | 'ANALISE_NAO_ENCONTRADA'

export interface AnalysisLookup {
  analysis: BusinessAnalysis | null
  missing: AnalysisMissing | null
}

/** O 404 do `GET /me/analysis` é um estado, não um erro: diz o que ainda falta. */
export function missingAnalysis(error: unknown): AnalysisMissing | null {
  if (!isAxiosError(error) || error.response?.status !== 404) return null
  const code = (error.response.data as { error?: unknown } | undefined)?.error
  return code === 'ONBOARDING_NAO_INICIADO' ? code : 'ANALISE_NAO_ENCONTRADA'
}

/**
 * Comentário do analista na reprovação. Ainda fora do contrato: lido de `review_comment` do
 * `GET /me/onboarding` quando a API o enviar.
 */
export function reviewComment(draft: OnboardingDraft | undefined): string | null {
  const value = (draft as { review_comment?: unknown } | undefined)?.review_comment
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Status do onboarding, análise e envio, com polling enquanto há algo para acontecer. */
export function useStatusQueries() {
  const api = usePortalApi()
  const queryClient = useQueryClient()

  const me = useQuery({
    queryKey: statusKeys.me,
    queryFn: api.onboarding.me,
    // A porta já buscou o `/me`: a página abre com ele e confirma em seguida.
    placeholderData: () => queryClient.getQueryData<Me>(portalKeys.me),
    refetchInterval: (query) => pollInterval(query.state.data?.onboarding_status),
  })
  const status = me.data?.onboarding_status

  const analysis = useQuery({
    queryKey: statusKeys.analysis,
    queryFn: async (): Promise<AnalysisLookup> => {
      try {
        return { analysis: await api.score.myAnalysis(), missing: null }
      } catch (error) {
        const missing = missingAnalysis(error)
        if (missing) return { analysis: null, missing }
        throw error
      }
    },
    enabled: status !== undefined && status !== 'APROVADO',
    refetchInterval: pollInterval(status),
  })

  const draft = useQuery({
    queryKey: portalKeys.draft,
    queryFn: api.onboarding.draft,
    enabled: status !== undefined,
    staleTime: 60_000,
  })

  return { me, analysis, draft, status }
}
