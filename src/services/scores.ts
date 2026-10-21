import { isAxiosError, type AxiosInstance } from 'axios'

import type { ScoreEvaluation, ScoreStrategy } from '@/types/api'

/** Credit Score API: avaliações de score (Strategy + Factory no backend). */
export function scoresApi(http: AxiosInstance) {
  return {
    strategies: () => http.get<ScoreStrategy[]>('/scores/strategies').then((r) => r.data),

    evaluate: (customerId: number, strategy?: string) =>
      http
        .post<ScoreEvaluation>('/scores/evaluations', { customer_id: customerId, strategy })
        .then((r) => r.data),

    /** Score vigente do cliente, ou `null` se ele ainda não foi avaliado. */
    latest: (customerId: number) =>
      http
        .get<ScoreEvaluation>(`/scores/customers/${customerId}/latest`)
        .then((r) => r.data)
        .catch((error: unknown) => {
          if (isAxiosError(error) && error.response?.status === 404) return null
          throw error
        }),

    history: (customerId: number) =>
      http
        .get<ScoreEvaluation[]>('/scores/evaluations', { params: { customer_id: customerId } })
        .then((r) => r.data),
  }
}
