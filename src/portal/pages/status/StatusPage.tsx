import { useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, CloudOff, FileText, PencilLine } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { Marca } from '@/components/brand/Logo'
import { errorMessage } from '@/lib/errors'

import { portalKeys } from '../../layout/queries'
import type { BusinessAnalysis, Me, OnboardingDraft, OnboardingStatus } from '../../types'
import { Button, ButtonLink } from '../../ui/Button'
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '../../ui/Surface'

import { CONFIRMACAO_MS, hasReading, isAiReading, momento } from './analysis'
import { ReadingTitle, ScoreFigure, StrengthsAndRisks } from './analysisView'
import { reviewComment, useStatusQueries, type AnalysisLookup } from './queries'
import { Timeline, type TimelineStep } from './Timeline'

/** A partir daqui a análise automática está mais lenta que o normal. */
const DEMORA_S = 120

const EASE = [0.16, 1, 0.3, 1] as const

/** Relógio que só anda quando há algo a medir (tempo desde o envio). */
function useNow(active: boolean, everyMs = 1_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [active, everyMs])
  return now
}

const ANUNCIO: Partial<Record<OnboardingStatus, string>> = {
  EM_ANALISE: 'Análise automática em andamento.',
  ANALISE_MANUAL: 'Cadastro encaminhado para um analista.',
  REPROVADO: 'Cadastro não aprovado.',
  APROVADO: 'Cadastro aprovado. Liberando o portal.',
}

export function StatusPage() {
  const { me, analysis, draft, status } = useStatusQueries()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Análise do cadastro"
        description="Acompanhe aqui a análise da sua empresa. Esta página se atualiza sozinha."
      />
      {/* Anuncia a troca de estado para leitores de tela, sem repetir a página inteira. */}
      <p role="status" className="sr-only">
        {status ? (ANUNCIO[status] ?? '') : ''}
      </p>
      {me.isPending ? (
        <StatusSkeleton />
      ) : me.isError && !me.data ? (
        <ErrorState
          title="Não conseguimos consultar a análise"
          message={`${errorMessage(me.error)} Verifique a conexão e tente de novo.`}
          onRetry={() => void me.refetch()}
        />
      ) : (
        <>
          {(me.isRefetchError || analysis.isRefetchError) && <StaleNotice />}
          <StatusBody
            me={me.data}
            lookup={analysis.data}
            analysisLoading={analysis.isPending && analysis.fetchStatus !== 'idle'}
            analysisError={analysis.isError && !analysis.data ? analysis.error : null}
            onRetryAnalysis={() => void analysis.refetch()}
            draft={draft.data}
          />
        </>
      )}
    </div>
  )
}

/** Falha de uma consulta periódica: mantém o que já está na tela e avisa com calma. */
function StaleNotice() {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-sm text-ink-muted">
      <CloudOff aria-hidden className="size-4 shrink-0" />
      Não conseguimos atualizar agora. Mostramos a última informação e tentamos de novo em
      instantes.
    </p>
  )
}

function StatusSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando a análise…"
      className="rounded-panel border border-line bg-surface p-6 shadow-raised"
    >
      <Skeleton className="h-6 w-64 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface StatusBodyProps {
  me: Me
  lookup: AnalysisLookup | undefined
  analysisLoading: boolean
  analysisError: unknown
  onRetryAnalysis: () => void
  draft: OnboardingDraft | undefined
}

function StatusBody({
  me,
  lookup,
  analysisLoading,
  analysisError,
  onRetryAnalysis,
  draft,
}: StatusBodyProps) {
  const status = me.onboarding_status
  const reduce = useReducedMotion()
  const notStarted =
    status === 'NAO_INICIADO' ||
    status === 'RASCUNHO' ||
    lookup?.missing === 'ONBOARDING_NAO_INICIADO'
  const submittedAt = draft?.updated_at ?? null

  let content: ReactNode
  if (status === 'APROVADO') content = <Approved />
  else if (notStarted) content = <NotSubmitted />
  else if (status === 'REPROVADO')
    content = <Rejected submittedAt={submittedAt} comment={reviewComment(draft)} />
  else if (status === 'ANALISE_MANUAL')
    content = (
      <Manual
        me={me}
        submittedAt={submittedAt}
        analysis={lookup?.analysis ?? null}
        analysisLoading={analysisLoading}
        analysisError={analysisError}
        onRetryAnalysis={onRetryAnalysis}
      />
    )
  else content = <Automatic submittedAt={submittedAt} />

  return (
    <motion.div
      // Cada estado entra com um fade curto: a troca (ex.: automática → analista) fica perceptível.
      key={notStarted ? 'NAO_ENVIADO' : status}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="space-y-6"
    >
      {content}
    </motion.div>
  )
}

function received(submittedAt: string | null): TimelineStep {
  return {
    id: 'recebido',
    title: 'Cadastro recebido',
    detail: submittedAt ? `Enviado ${momento(submittedAt)}` : 'Dados, respostas e observações',
    state: 'done',
  }
}

function StatusHeading({ children, text }: { children: string; text: ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      <div className="max-w-[62ch] text-sm text-ink-muted">{text}</div>
    </div>
  )
}

function Automatic({ submittedAt }: { submittedAt: string | null }) {
  const now = useNow(Boolean(submittedAt))
  const elapsed = submittedAt ? (now - new Date(submittedAt).getTime()) / 1000 : 0
  const slow = elapsed >= DEMORA_S
  return (
    <Panel>
      <StatusHeading
        text={
          slow ? (
            'Está levando mais que o normal. Seguimos acompanhando: você pode fechar esta página e voltar depois, o resultado fica salvo.'
          ) : (
            <>
              Regras de crédito e a IA da <Marca /> estão lendo os dados e as observações do seu
              negócio. Costuma levar de alguns segundos a um minuto.
            </>
          )
        }
      >
        Estamos analisando sua empresa
      </StatusHeading>
      <Timeline
        label="Etapas da análise"
        steps={[
          received(submittedAt),
          {
            id: 'automatica',
            title: 'Análise automática',
            detail: 'Regras e IA leem faturamento, prazos, dívidas e observações',
            state: 'current',
          },
          {
            id: 'decisao',
            title: 'Decisão',
            detail: 'Aprovação na hora ou encaminhamento para um analista',
            state: 'pending',
          },
        ]}
      />
    </Panel>
  )
}

interface ManualProps {
  me: Me
  submittedAt: string | null
  analysis: BusinessAnalysis | null
  analysisLoading: boolean
  analysisError: unknown
  onRetryAnalysis: () => void
}

function Manual({
  me,
  submittedAt,
  analysis,
  analysisLoading,
  analysisError,
  onRetryAnalysis,
}: ManualProps) {
  const email = me.empresa?.email
  return (
    <>
      <Panel>
        <StatusHeading
          text={
            <>
              A análise automática concluiu que o perfil da sua empresa pede um olhar humano. Isso é
              comum em negócios com operação própria e{' '}
              <strong className="font-medium text-ink">não indica reprovação</strong>. Costuma levar
              até 1 dia útil.
            </>
          }
        >
          Seu cadastro está com um analista
        </StatusHeading>
        <Timeline
          label="Etapas da análise"
          steps={[
            received(submittedAt),
            {
              id: 'automatica',
              title: 'Análise automática',
              detail: 'Concluída: encaminhada para revisão',
              state: 'done',
            },
            {
              id: 'analista',
              title: 'Revisão por um analista',
              detail: 'Normalmente em até 1 dia útil',
              state: 'current',
            },
            {
              id: 'decisao',
              title: 'Decisão',
              detail: 'O portal é liberado assim que o cadastro for aprovado',
              state: 'pending',
            },
          ]}
        />
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-ink">O que acontece agora</h3>
          <ul className="mt-2.5 space-y-2 text-sm text-ink-muted">
            <li className="flex gap-2">
              <Dot />
              Um analista revisa os dados da empresa, as respostas do segmento e as suas
              observações.
            </li>
            <li className="flex gap-2">
              <Dot />
              {email ? (
                <span>
                  Se precisar de algo, ele fala com você por{' '}
                  <span className="text-ink">{email}</span>.
                </span>
              ) : (
                'Se precisar de algo, ele fala com você pelo e-mail do cadastro.'
              )}
            </li>
            <li className="flex gap-2">
              <Dot />
              Você não precisa fazer nada: quando a decisão sair, esta página se atualiza.
            </li>
          </ul>
        </div>
      </Panel>
      <PartialAnalysis
        analysis={analysis}
        loading={analysisLoading}
        error={analysisError}
        onRetry={onRetryAnalysis}
      />
    </>
  )
}

function Dot() {
  return <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
}

function PartialAnalysis({
  analysis,
  loading,
  error,
  onRetry,
}: {
  analysis: BusinessAnalysis | null
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Carregando a prévia da análise…" className="space-y-3">
        <Skeleton className="h-28 w-full rounded-panel" />
      </div>
    )
  }
  if (error) {
    return (
      <ErrorState
        title="Não conseguimos carregar a prévia da análise"
        message={`${errorMessage(error)} Isso não afeta a revisão do seu cadastro.`}
        onRetry={onRetry}
      />
    )
  }
  if (!analysis || !hasReading(analysis)) return null
  const ai = isAiReading(analysis.gerado_por)
  return (
    <Panel
      id="previa"
      title="Prévia da análise"
      description="O que a análise automática já leu do seu negócio. A decisão final é do analista."
    >
      <div className="space-y-6">
        <ScoreFigure analysis={analysis} />
        {analysis.resumo?.trim() && (
          <div className="space-y-1.5">
            <ReadingTitle ai={ai}>
              Leitura da <Marca />
            </ReadingTitle>
            <p className="max-w-[68ch] text-sm text-ink">{analysis.resumo}</p>
          </div>
        )}
        <StrengthsAndRisks
          ai={ai}
          pontos_fortes={analysis.pontos_fortes ?? []}
          riscos={analysis.riscos ?? []}
        />
      </div>
    </Panel>
  )
}

function Rejected({
  submittedAt,
  comment,
}: {
  submittedAt: string | null
  comment: string | null
}) {
  // REPROVADO pode abrir o onboarding (routing.ts): o wizard carrega o envio anterior preenchido
  // e mostra o comentário do analista.
  return (
    <Panel>
      <StatusHeading text="Analisamos os dados e as observações que você enviou e, neste momento, não conseguimos liberar a conta. Você pode revisar as informações e enviar de novo: a nova análise começa do zero.">
        Seu cadastro não foi aprovado agora
      </StatusHeading>
      <Timeline
        label="Etapas da análise"
        steps={[
          received(submittedAt),
          { id: 'analise', title: 'Análise', detail: 'Concluída', state: 'done' },
          {
            id: 'decisao',
            title: 'Decisão',
            detail: 'Cadastro não aprovado',
            state: 'failed',
          },
        ]}
      />
      {comment && (
        <figure className="mt-6 border-t border-line pt-5">
          <figcaption className="text-sm font-semibold text-ink">Comentário do analista</figcaption>
          <blockquote className="mt-1.5 max-w-[68ch] text-sm text-ink-muted">{comment}</blockquote>
        </figure>
      )}
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
        <ButtonLink
          to="/app/onboarding"
          variant="primary"
          icon={<PencilLine aria-hidden className="size-4" />}
        >
          Revisar e reenviar
        </ButtonLink>
        <p className="text-sm text-ink-muted">Seus dados continuam preenchidos.</p>
      </div>
    </Panel>
  )
}

function Approved() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const done = useRef(false)

  const release = useCallback(async () => {
    if (done.current) return
    done.current = true
    // Renova o `/me` da porta (que leva a /app) e a análise que as abas vão usar.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: portalKeys.me }),
      queryClient.invalidateQueries({ queryKey: portalKeys.analysis }),
    ])
    void navigate('/app', { replace: true })
  }, [queryClient, navigate])

  useEffect(() => {
    const id = window.setTimeout(() => void release(), CONFIRMACAO_MS)
    return () => window.clearTimeout(id)
  }, [release])

  return (
    <Panel>
      <div className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center">
        <motion.span
          aria-hidden
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
        >
          <Check className="size-6" strokeWidth={2.5} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Cadastro aprovado</h2>
          <p className="text-sm text-ink-muted">
            Estamos abrindo o seu portal: visão geral, vendas, recebíveis, pagamentos e crédito.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<ArrowRight aria-hidden className="size-4" />}
          onClick={() => void release()}
        >
          Abrir o portal
        </Button>
      </div>
    </Panel>
  )
}

function NotSubmitted() {
  return (
    <Panel>
      <EmptyState
        icon={<FileText aria-hidden className="size-5" />}
        title="Seu cadastro ainda não foi enviado"
        action={<ButtonLink to="/app/onboarding">Continuar o cadastro</ButtonLink>}
      >
        A análise começa quando você envia os dados da empresa. Leva poucos minutos e o rascunho
        fica salvo.
      </EmptyState>
    </Panel>
  )
}
