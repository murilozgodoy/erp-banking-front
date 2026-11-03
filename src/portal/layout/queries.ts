import { useQuery } from '@tanstack/react-query'

import { usePortalApi } from '../api'

/** Chaves do React Query do portal: invalide por prefixo (`['portal', 'erp']`). */
export const portalKeys = {
  me: ['portal', 'me'] as const,
  draft: ['portal', 'onboarding', 'draft'] as const,
  templates: ['portal', 'onboarding', 'templates'] as const,
  analysis: ['portal', 'analysis'] as const,
  overview: ['portal', 'erp', 'overview'] as const,
  erp: ['portal', 'erp'] as const,
}

/** Quem é o cliente e em que ponto do onboarding está (`GET /me` do Onboarding). */
export function useMe() {
  const api = usePortalApi()
  return useQuery({ queryKey: portalKeys.me, queryFn: api.onboarding.me, staleTime: 15_000 })
}

/** Análise do negócio (KPIs, insights, oportunidades), compartilhada por todas as abas. */
export function useAnalysis(enabled = true) {
  const api = usePortalApi()
  return useQuery({
    queryKey: portalKeys.analysis,
    queryFn: api.score.myAnalysis,
    enabled,
    staleTime: 60_000,
  })
}

/** Saldo, conta e resumo do ERP (topo do portal e visão geral). */
export function useOverview(enabled = true) {
  const api = usePortalApi()
  return useQuery({
    queryKey: portalKeys.overview,
    queryFn: api.erp.overview,
    enabled,
    staleTime: 30_000,
  })
}
