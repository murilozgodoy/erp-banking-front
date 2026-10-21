import type { AxiosInstance } from 'axios'

import type { CreditRequest, CreditRequestInput } from '@/types/api'

/** Transactions API: pedidos de crédito (decididos a partir do score vigente). */
export function creditsApi(http: AxiosInstance) {
  return {
    list: (customerId?: number) =>
      http.get<CreditRequest[]>('/credits', { params: { customerId } }).then((r) => r.data),

    get: (id: number) => http.get<CreditRequest>(`/credits/${id}`).then((r) => r.data),

    request: (input: CreditRequestInput) =>
      http.post<CreditRequest>('/credits', input).then((r) => r.data),
  }
}
