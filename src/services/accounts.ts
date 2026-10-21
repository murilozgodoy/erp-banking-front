import type { AxiosInstance } from 'axios'

import type { Account, AccountInput, Transaction, TransactionInput } from '@/types/api'

/** Transactions API: contas, extrato e lançamentos. */
export function accountsApi(http: AxiosInstance) {
  return {
    list: (customerId?: number) =>
      http.get<Account[]>('/accounts', { params: { customerId } }).then((r) => r.data),

    get: (id: number) => http.get<Account>(`/accounts/${id}`).then((r) => r.data),

    create: (input: AccountInput) => http.post<Account>('/accounts', input).then((r) => r.data),

    statement: (accountId: number) =>
      http.get<Transaction[]>(`/accounts/${accountId}/transactions`).then((r) => r.data),

    registerTransaction: (input: TransactionInput) =>
      http.post<Transaction>('/transactions', input).then((r) => r.data),
  }
}
