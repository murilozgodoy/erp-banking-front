export type QueueStatus = 'ANALISE_MANUAL' | 'EM_ANALISE' | 'APROVADO' | 'REPROVADO'

/** Chaves do React Query da fila (backoffice). */
export const queueKeys = {
  all: ['backoffice', 'analises'] as const,
  list: (status: QueueStatus) => ['backoffice', 'analises', status] as const,
  analysis: (customerId: number) => ['backoffice', 'analises', 'analise', customerId] as const,
}
