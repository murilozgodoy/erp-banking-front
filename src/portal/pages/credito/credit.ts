import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'

import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { pct } from '../../lib/format'
import { portalKeys } from '../../layout/queries'
import { mensagemDoErroDePermissao } from '../../team/forbidden'
import { useMembro } from '../../team/useMembro'
import type { ErpApiError, ProdutoCredito, Simulation, SimulationRequest } from '../../types'

export const SIMULATION_ROOT = ['portal', 'credit-simulation'] as const

/** Chaves do crédito sob `portalKeys.erp`: contratar invalida tudo de uma vez. */
export const creditKeys = {
  offers: [...portalKeys.erp, 'credit', 'offers'] as const,
  requests: [...portalKeys.erp, 'credit', 'requests'] as const,
  receivables: [...portalKeys.erp, 'receivables'] as const,
  /** Fora de `erp`: invalidar o ERP não deve gerar novas simulações sozinho. */
  simulation: (input: SimulationRequest) => [...SIMULATION_ROOT, input] as const,
}

export function useOffers() {
  const api = usePortalApi()
  return useQuery({ queryKey: creditKeys.offers, queryFn: api.erp.offers, staleTime: 60_000 })
}

export function useCreditRequests() {
  const api = usePortalApi()
  return useQuery({ queryKey: creditKeys.requests, queryFn: api.erp.creditRequests })
}

/** Valor que só muda depois de `ms` sem alterações. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/**
 * Simulação automática: espera 300 ms sem mudanças e chama `POST /me/credit/simulations`.
 * `input` nulo (valor inválido) não simula. Mantém o último resultado enquanto recalcula.
 */
export function useSimulation(input: SimulationRequest | null) {
  const api = usePortalApi()
  const key = input ? JSON.stringify(input) : null
  const debouncedKey = useDebounced(key)
  const debounced = debouncedKey ? (JSON.parse(debouncedKey) as SimulationRequest) : null
  const query = useQuery({
    queryKey: debounced ? creditKeys.simulation(debounced) : SIMULATION_ROOT,
    queryFn: () => api.erp.simulate(debounced as SimulationRequest),
    enabled: debounced !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 60_000,
  })
  /** Digitação ainda não simulada ou simulação em andamento. */
  const pending = key !== debouncedKey || query.isFetching
  return { ...query, pending, active: input !== null }
}

function deAntecipacao(query: Query): boolean {
  const input = query.queryKey[2] as SimulationRequest | undefined
  return input?.produto === 'ANTECIPACAO_RECEBIVEIS'
}

/** `POST /me/credit/requests`; aprovado muda saldo, contas e recebíveis. */
export function useContract({ onError }: { onError?: (error: Error) => void } = {}) {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (simulationId: string) => api.erp.requestCredit({ simulation_id: simulationId }),
    onError,
    onSuccess: async (request) => {
      // A simulação usada não serve mais: a próxima contratação precisa de uma nova. A da
      // antecipação só fica marcada: os recebíveis dela acabaram de mudar e refazê-la daria 422.
      void queryClient.invalidateQueries({
        queryKey: SIMULATION_ROOT,
        predicate: (q) => !deAntecipacao(q),
      })
      void queryClient.invalidateQueries({
        queryKey: SIMULATION_ROOT,
        predicate: deAntecipacao,
        refetchType: 'none',
      })
      if (request.status === 'APROVADO') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: portalKeys.erp }),
          queryClient.invalidateQueries({ queryKey: portalKeys.overview }),
        ])
      } else {
        await queryClient.invalidateQueries({ queryKey: creditKeys.requests })
      }
    },
  })
}

/** `POST /me/credit/requests/{id}/confirm`: contrata uma proposta AGUARDANDO_CONTRATACAO. */
export function useConfirmCredit() {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.erp.confirmCreditRequest(id),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: portalKeys.erp }),
        queryClient.invalidateQueries({ queryKey: portalKeys.overview }),
      ]),
  })
}

const MENSAGENS: Record<string, string> = {
  PEDIDO_NAO_AGUARDANDO_CONTRATACAO:
    'Esta proposta já foi contratada ou mudou de status. Atualizamos a lista de propostas.',
  PEDIDO_NAO_ENCONTRADO: 'Não encontramos esta proposta. Atualizamos a lista de propostas.',
  SIMULACAO_EXPIRADA: 'Esta simulação expirou. Simule de novo para ver as condições de hoje.',
  SIMULACAO_JA_UTILIZADA:
    'Esta simulação já virou uma proposta. Confira em Propostas e contratos ou simule de novo.',
  SIMULACAO_NAO_ENCONTRADA: 'Não encontramos esta simulação. Simule de novo para contratar.',
  RECEBIVEL_INDISPONIVEL:
    'Um dos recebíveis selecionados já foi recebido ou antecipado. Atualizamos a lista: escolha de novo e simule.',
  RECEBIVEL_NAO_ENCONTRADO:
    'Um dos recebíveis selecionados não existe mais. Atualize a seleção e simule de novo.',
}

function corpoErro(error: unknown): ErpApiError | null {
  if (!isAxiosError(error)) return null
  const data: unknown = error.response?.data
  return data && typeof data === 'object' ? (data as ErpApiError) : null
}

/** Código `error` do corpo (`SIMULACAO_EXPIRADA`...), se houver. */
export function errorCode(error: unknown): string | null {
  return corpoErro(error)?.error ?? null
}

export { isOnboardingPendente } from '../../lib/apiErrors'

/** Mensagem das rotas de crédito: problema + o que fazer. */
export function creditErrorMessage(error: unknown): string {
  const semPermissao = mensagemDoErroDePermissao(error)
  if (semPermissao) return semPermissao
  const body = corpoErro(error)
  if (body) {
    if (body.error && MENSAGENS[body.error]) return MENSAGENS[body.error]
    const campo = body.campos && Object.values(body.campos)[0]
    if (campo) return campo
    if (body.message) return body.message
  }
  return errorMessage(error)
}

/**
 * O que o membro pode fazer no crédito (seção 11): `pede` simula e envia propostas; `contrata`
 * confirma. Quem só pede manda a proposta para alguém contratar (`AGUARDANDO_CONTRATACAO`).
 */
export function useCreditAccess() {
  const { pode } = useMembro()
  return { pede: pode('pedir_credito'), contrata: pode('contratar_credito') }
}

/** Rótulo do botão que envia a simulação, conforme a aprovação e a permissão. */
export function contractLabel(
  aprovacao: Simulation['aprovacao'] | undefined,
  contrata: boolean,
  contratar = 'Contratar',
  analise = 'Enviar proposta',
): string {
  if (aprovacao === 'ANALISE') return analise
  return contrata ? contratar : 'Enviar proposta para contratação'
}

/** Prazos oferecidos no seletor, até o máximo do produto. */
export function prazosValidos(max: number): number[] {
  if (max <= 6) return Array.from({ length: max }, (_, i) => i + 1)
  const base = [3, 6, 12, 18, 24, 36].filter((p) => p <= max)
  if (!base.includes(max)) base.push(max)
  return base.length > 5 ? base.slice(-5) : base
}

export const ORDEM_PRODUTOS: ProdutoCredito[] = [
  'ANTECIPACAO_RECEBIVEIS',
  'CAPITAL_DE_GIRO',
  'ALAVANCAGEM',
  'FINANCIAMENTO_ESTOQUE',
  'CONSOLIDACAO_DIVIDAS',
]

export function isProduto(value: string | null): value is ProdutoCredito {
  return value !== null && (ORDEM_PRODUTOS as string[]).includes(value)
}

/** Taxa do DTO de proposta vem em FRAÇÃO ao mês (0.0249): converte para "2,49% a.m.". */
export function taxaFracao(taxa: number | null): string {
  return taxa === null ? '—' : `${pct(taxa * 100, 2)} a.m.`
}
