import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, Inbox, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { RequirePermission } from '@/components/auth/RequirePermission'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'
import { usePortalApi } from '@/portal/api'
import { formatCnpj } from '@/portal/lib/format'
import { FaixaPill } from '@/portal/pages/status/analysisView'
import type { ReviewDecision, ReviewItem } from '@/portal/types'
import { DataTable, type Column } from '@/portal/ui/DataTable'
import { Segmented } from '@/portal/ui/Segmented'
import { EmptyState, ErrorState, Panel, Skeleton } from '@/portal/ui/Surface'

import {
  dateTime,
  GERADO_POR_LABEL,
  isOverdue,
  relativeInstant,
  segmentoLabel,
  waitingTime,
} from './format'
import { queueKeys, type QueueStatus } from './queue'
import { ReviewSheet } from './ReviewSheet'
import { Marca } from '@/components/brand/Logo'

const FILTERS: { value: QueueStatus; label: string; empty: string; teach: string }[] = [
  {
    value: 'ANALISE_MANUAL',
    label: 'Aguardando decisão',
    empty: 'Nenhuma empresa aguardando análise',
    teach:
      'Quando a análise automática encaminhar uma empresa para decisão humana (segmento “outro”, perfil específico, baixa confiança da IA ou regra crítica), ela aparece aqui.',
  },
  {
    value: 'EM_ANALISE',
    label: 'Em análise automática',
    empty: 'Nenhuma empresa em análise automática',
    teach: 'Os envios ficam aqui só pelos segundos em que regras e IA estão rodando.',
  },
  {
    value: 'APROVADO',
    label: 'Aprovadas',
    empty: 'Nenhuma empresa aprovada ainda',
    teach: 'As empresas aprovadas, automaticamente ou por um analista, aparecem aqui.',
  },
  {
    value: 'REPROVADO',
    label: 'Reprovadas',
    empty: 'Nenhuma empresa reprovada',
    teach: 'As reprovações ficam registradas aqui com o comentário do analista.',
  },
]

function isQueueStatus(value: string | null): value is QueueStatus {
  return FILTERS.some((f) => f.value === value)
}

interface Notice {
  tone: 'positive' | 'warning'
  text: string
}

/** Fila de análise manual do onboarding (backoffice, `review:onboarding`). */
export function AnalisesPage() {
  return (
    <RequirePermission permission="review:onboarding">
      <ReviewQueue />
    </RequirePermission>
  )
}

function ReviewQueue() {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('status')
  const status: QueueStatus = isQueueStatus(param) ? param : 'ANALISE_MANUAL'
  const filter = FILTERS.find((f) => f.value === status)!
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const queue = useQuery({
    queryKey: queueKeys.list(status),
    queryFn: () => api.onboarding.reviews(status),
  })

  const decide = useMutation({
    mutationFn: ({
      item,
      decision,
    }: {
      item: ReviewItem
      decision: ReviewDecision
      status: QueueStatus
    }) => api.onboarding.decide(item.customer_id, decision),
    onMutate: async ({ item, status: listStatus }) => {
      const key = queueKeys.list(listStatus)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReviewItem[]>(key)
      // Otimista: a empresa sai da fila na hora; volta se a API recusar.
      queryClient.setQueryData<ReviewItem[]>(key, (rows) =>
        rows?.filter((row) => row.customer_id !== item.customer_id),
      )
      return { previous, key }
    },
    onSuccess: (_result, { item, decision }) => {
      setSelected(null)
      setNotice({
        tone: 'positive',
        text:
          decision.decisao === 'APROVADO'
            ? `${item.empresa.razao_social} aprovada. O portal da empresa já está liberado.`
            : `${item.empresa.razao_social} reprovada. A empresa pode revisar o cadastro e reenviar.`,
      })
    },
    onError: (error, { item }, context) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        // Outra pessoa decidiu antes: a remoção vale, e a fila é recarregada.
        setSelected(null)
        setNotice({
          tone: 'warning',
          text: `${item.empresa.razao_social} já foi decidida por outra pessoa da equipe. Atualizamos a fila.`,
        })
        return
      }
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKeys.all }),
  })

  const open = (item: ReviewItem) => {
    decide.reset()
    setSelected(item)
  }

  const now = useMinuteClock()
  const waiting = status === 'ANALISE_MANUAL'
  const columns: Column<ReviewItem>[] = [
    {
      key: 'empresa',
      header: 'Empresa',
      sort: (row) => row.empresa.razao_social.toLocaleLowerCase('pt-BR'),
      cell: (row) => (
        <div className="min-w-48">
          <button
            type="button"
            onClick={() => open(row)}
            className="text-left font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
          >
            {row.empresa.razao_social}
          </button>
          <p className="tabular text-xs text-ink-muted">{formatCnpj(row.empresa.cnpj ?? '')}</p>
        </div>
      ),
    },
    {
      key: 'segmento',
      header: 'Segmento',
      hideBelow: 'md',
      sort: (row) => segmentoLabel(row.segmento),
      cell: (row) => <span className="text-ink-muted">{segmentoLabel(row.segmento)}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      sort: (row) => row.analise?.score ?? -1,
      cell: (row) =>
        row.analise?.score ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular font-medium text-ink">{row.analise.score}</span>
            <FaixaPill faixa={row.analise.faixa_risco} />
          </div>
        ) : (
          <span className="text-ink-faint">Sem análise</span>
        ),
    },
    {
      key: 'gerado',
      header: 'Gerado por',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-ink-muted">
          {row.analise?.gerado_por
            ? (GERADO_POR_LABEL[row.analise.gerado_por] ?? row.analise.gerado_por)
            : '—'}
        </span>
      ),
    },
    {
      key: 'enviado',
      header: 'Enviado',
      hideBelow: 'sm',
      sort: (row) => row.submitted_at,
      cell: (row) => (
        <time dateTime={row.submitted_at} className="block whitespace-nowrap">
          <span className="text-ink">{relativeInstant(row.submitted_at)}</span>
          <span className="block text-xs text-ink-muted">{dateTime(row.submitted_at)}</span>
        </time>
      ),
    },
    ...(waiting
      ? [
          {
            key: 'espera',
            header: 'Na fila há',
            align: 'right' as const,
            sort: (row: ReviewItem) => row.submitted_at,
            cell: (row: ReviewItem) => {
              const late = isOverdue(row.submitted_at, now)
              return (
                <span
                  className={cn(
                    'whitespace-nowrap',
                    late ? 'font-medium text-warning' : 'text-ink',
                  )}
                >
                  {waitingTime(row.submitted_at, now)}
                  {late && <span className="sr-only"> (mais de 1 dia)</span>}
                </span>
              )
            },
          },
        ]
      : []),
  ]

  const count = queue.data?.length ?? 0

  return (
    <section className="space-y-6">
      <PageHeader
        title="Fila de análise"
        description={
          <>
            Empresas que a <Marca /> encaminhou para decisão humana, da mais antiga para a mais
            nova.
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Status da análise"
          value={status}
          options={FILTERS.map(({ value, label }) => ({ value, label }))}
          onChange={(value) => {
            setNotice(null)
            setSearchParams(value === 'ANALISE_MANUAL' ? {} : { status: value })
          }}
          className="max-w-full overflow-x-auto"
        />
        {queue.isSuccess && (
          <p className="tabular text-sm text-ink-muted" aria-live="polite">
            {count === 1 ? '1 empresa' : `${count} empresas`}
          </p>
        )}
      </div>

      <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />

      {queue.isPending ? (
        <QueueSkeleton />
      ) : queue.isError ? (
        <ErrorState
          title="Não conseguimos carregar a fila"
          message={`${errorMessage(queue.error)} Verifique a conexão e tente de novo.`}
          onRetry={() => void queue.refetch()}
        />
      ) : (
        <Panel flush>
          <DataTable
            caption={`Fila de análise: ${filter.label.toLowerCase()}`}
            columns={columns}
            rows={queue.data}
            rowKey={(row) => row.customer_id}
            initialSort={{ key: 'enviado', direction: 'asc' }}
            empty={
              <EmptyState icon={<Inbox aria-hidden className="size-5" />} title={filter.empty}>
                {filter.teach}
              </EmptyState>
            }
          />
        </Panel>
      )}

      <ReviewSheet
        item={selected}
        canDecide={status === 'ANALISE_MANUAL'}
        onClose={() => setSelected(null)}
        pending={decide.isPending}
        error={decide.isError && selected ? decide.error : null}
        onDecide={(item, decision) => decide.mutate({ item, decision, status })}
      />
    </section>
  )
}

/** Hora atual, renovada a cada minuto (tempo de espera na fila). */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function NoticeBar({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const reduce = useReducedMotion()
  return (
    <div role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            key={notice.text}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'flex items-start gap-3 rounded-panel border px-4 py-3 text-sm',
              notice.tone === 'positive'
                ? 'border-positive/25 bg-positive-soft'
                : 'border-warning/25 bg-warning-soft',
            )}
          >
            {notice.tone === 'positive' ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
            ) : (
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <p className="flex-1 text-ink">{notice.text}</p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar aviso"
              className="grid size-6 place-items-center rounded-control text-ink-muted hover:bg-surface hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QueueSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando a fila…"
      className="rounded-panel border border-line bg-surface shadow-raised"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-6 border-b border-line px-5 py-3.5 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-56 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-3.5 w-20 md:block" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
        </div>
      ))}
    </div>
  )
}
