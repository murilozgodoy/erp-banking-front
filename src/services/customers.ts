import type { AxiosInstance } from 'axios'

import type { Anamnesis, AnamnesisInput, Customer, CustomerInput } from '@/types/api'

/** Onboarding API: clientes e anamnese. */
export function customersApi(http: AxiosInstance) {
  return {
    list: (params: { q?: string; limit?: number } = {}) =>
      http.get<Customer[]>('/customers', { params }).then((r) => r.data),

    get: (id: number) => http.get<Customer>(`/customers/${id}`).then((r) => r.data),

    create: (input: CustomerInput) => http.post<Customer>('/customers', input).then((r) => r.data),

    saveAnamnesis: (customerId: number, input: AnamnesisInput) =>
      http.put<Anamnesis>(`/customers/${customerId}/anamnesis`, input).then((r) => r.data),
  }
}
