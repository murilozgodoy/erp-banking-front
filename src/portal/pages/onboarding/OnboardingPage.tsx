import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ArrowLeft, ArrowRight, Eye, MessageSquareText, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { errorMessage } from '@/lib/errors'

import { usePortalApi } from '../../api'
import { fullDate } from '../../lib/format'
import { portalKeys } from '../../layout/queries'
import { useMembro } from '../../team/useMembro'
import { Button } from '../../ui/Button'
import { ErrorState, PageHeader, Skeleton } from '../../ui/Surface'
import type {
  Empresa,
  OnboardingDraft,
  OnboardingTemplate,
  OnboardingValidationError,
  RespostaValor,
  Segmento,
} from '../../types'
import { EmpresaStep } from './EmpresaStep'
import {
  CONDICIONAIS,
  errorsFromServer,
  firstIncompleteStep,
  fromDraft,
  LAST_STEP,
  labelOfKey,
  orderedErrors,
  STEPS,
  stepOfKey,
  templateOf,
  toPayload,
  validateAll,
  validateEmpresa,
  validateStep,
  type Errors,
  type WizardState,
} from './model'
import { PerguntasStep } from './PerguntasStep'
import { RevisaoStep } from './RevisaoStep'
import { SegmentoStep } from './SegmentoStep'
import { isConflict, useAutosave } from './useAutosave'
import { ErrorSummary, SaveIndicator, StepProgress } from './WizardChrome'

const TITLE = 'Cadastro da empresa'
const DESCRIPTION =
  'Quatro passos, cerca de cinco minutos. O rascunho é salvo enquanto você preenche.'
const DESCRIPTION_LEITURA =
  'O cadastro é preenchido pelo dono da empresa. Você pode consultar os passos, sem editar.'

/** Wizard de onboarding (PORTAL_CLIENTE.md, seções 1 e 3): empresa, segmento, perguntas, revisão. */
export function OnboardingPage() {
  const { membro: membroAtual } = useMembro()
  const readOnlyHeader = membroAtual !== null && membroAtual.papel !== 'DONO'
  const api = usePortalApi()
  const templates = useQuery({
    queryKey: portalKeys.templates,
    queryFn: api.onboarding.templates,
    staleTime: Infinity,
  })
  const draft = useQuery({
    queryKey: portalKeys.draft,
    queryFn: api.onboarding.draft,
    refetchOnWindowFocus: false,
  })

  let body: ReactNode
  if (templates.isPending || draft.isPending) {
    body = <WizardSkeleton />
  } else if (templates.isError || draft.isError) {
    body = (
      <ErrorState
        title="Não conseguimos abrir o seu cadastro"
        message={`${errorMessage(templates.error ?? draft.error)} O que você já preencheu continua salvo.`}
        onRetry={() => {
          if (templates.isError) void templates.refetch()
          if (draft.isError) void draft.refetch()
        }}
      />
    )
  } else if (templates.data.length === 0) {
    body = (
      <ErrorState
        title="Os segmentos não estão disponíveis agora"
        message="Sem eles não dá para montar as perguntas. Tente de novo em instantes."
        onRetry={() => void templates.refetch()}
      />
    )
  } else {
    const status = draft.data.onboarding_status
    if (status === 'EM_ANALISE' || status === 'ANALISE_MANUAL') {
      return <Navigate to="/app/status" replace />
    }
    if (status === 'APROVADO') return <Navigate to="/app" replace />
    body = <Wizard templates={templates.data} draft={draft.data} />
  }

  return (
    <div>
      <PageHeader title={TITLE} description={readOnlyHeader ? DESCRIPTION_LEITURA : DESCRIPTION} />
      {body}
    </div>
  )
}

function WizardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando o cadastro…"
      className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10"
    >
      <div className="lg:hidden">
        <Skeleton className="mb-2 h-3.5 w-32" />
        <Skeleton className="h-1 w-full" />
      </div>
      <div className="hidden space-y-6 lg:block">
        {STEPS.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-6 rounded-panel border border-line bg-surface p-5 shadow-raised sm:p-8">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReprovadoNote({
  comment,
  reviewedAt,
}: {
  comment?: string | null
  reviewedAt?: string | null
}) {
  return (
    <section
      aria-labelledby="reprovado-titulo"
      className="mb-6 flex gap-3 rounded-panel border border-warning/30 bg-warning-soft p-4 sm:p-5"
    >
      <MessageSquareText aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="min-w-0 space-y-1">
        <h2 id="reprovado-titulo" className="text-sm font-semibold text-ink">
          O cadastro anterior não foi aprovado
        </h2>
        {comment?.trim() ? (
          <>
            <p className="text-sm text-ink-muted">
              Comentário do analista{reviewedAt ? ` em ${fullDate(reviewedAt)}` : ''}:
            </p>
            <blockquote className="text-sm text-ink">“{comment.trim()}”</blockquote>
            <p className="text-sm text-ink-muted">
              Ajuste o que for preciso e envie de novo. Seus dados anteriores já estão preenchidos.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Revise os dados, principalmente os financeiros, e envie de novo. Uma explicação nas
            observações ajuda o analista a entender o negócio.
          </p>
        )}
      </div>
    </section>
  )
}

/** Quem não é o dono vê o cadastro, mas não edita (o `PUT /me/onboarding` dá 403, seção 11). */
function ReadOnlyNote() {
  return (
    <section
      aria-labelledby="somente-leitura-titulo"
      className="mb-6 flex gap-3 rounded-panel border border-line bg-sunken p-4 sm:p-5"
    >
      <Eye aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" />
      <div className="min-w-0 space-y-1">
        <h2 id="somente-leitura-titulo" className="text-sm font-semibold text-ink">
          Só o dono da empresa edita o cadastro
        </h2>
        <p className="text-sm text-ink-muted">
          Você pode navegar pelos passos e conferir os dados, mas não alterar nem enviar. Se algo
          precisa mudar, peça ao dono da empresa.
        </p>
      </div>
    </section>
  )
}

/** Avisa o pai quando o passo terminou de entrar (foco depois da transição). */
function StepFrame({ onEntered, children }: { onEntered: () => void; children: ReactNode }) {
  useEffect(() => {
    onEntered()
  }, [onEntered])
  return children
}

const EASE = [0.16, 1, 0.3, 1] as const

interface WizardProps {
  templates: OnboardingTemplate[]
  draft: OnboardingDraft
}

function initialState(templates: OnboardingTemplate[], draft: OnboardingDraft): WizardState {
  const state = fromDraft(draft)
  // Segmento que saiu do catálogo: o cliente escolhe de novo.
  return templateOf(templates, state.segmento) ? state : { ...state, segmento: null }
}

function Wizard({ templates, draft }: WizardProps) {
  const api = usePortalApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { membro } = useMembro()
  // Sem `membro` (API antiga) vale acesso total, como no resto do portal.
  const readOnly = membro !== null && membro.papel !== 'DONO'

  const [state, setState] = useState(() => initialState(templates, draft))
  const [step, setStep] = useState(() => {
    if (draft.onboarding_status === 'NAO_INICIADO') return 0
    const inicial = initialState(templates, draft)
    return firstIncompleteStep(inicial, templateOf(templates, inicial.segmento))
  })
  const [reachable, setReachable] = useState(step)
  const [direction, setDirection] = useState(1)
  const [errors, setErrors] = useState<Errors>({})
  const [summaryKeys, setSummaryKeys] = useState<string[]>([])
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const template = templateOf(templates, state.segmento)
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusTarget = useRef<string | null>(null)

  const goToStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: portalKeys.me })
    await queryClient.invalidateQueries({ queryKey: portalKeys.draft })
    navigate('/app/status', { replace: true })
  }, [navigate, queryClient])

  const autosave = useAutosave<WizardState>({
    save: (value) => api.onboarding.saveDraft(toPayload(value, false)),
    onConflict: () => void goToStatus(),
  })
  const { schedule, flush } = autosave

  // Toda mudança agenda o rascunho; o estado vindo do servidor não é salvo de volta.
  const loaded = useRef(state)
  useEffect(() => {
    if (state !== loaded.current && !readOnly) schedule(state)
  }, [state, schedule, readOnly])

  const focusKey = useCallback(
    (key: string) => {
      if (key === 'heading') {
        headingRef.current?.focus()
        return
      }
      const form = formRef.current
      const target =
        form?.querySelector<HTMLElement>(`[name="${key}"]:checked`) ??
        form?.querySelector<HTMLElement>(`[name="${key}"]`)
      target?.focus()
      target?.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    },
    [reduce],
  )

  const onEntered = useCallback(() => {
    const key = focusTarget.current
    focusTarget.current = null
    if (key) focusKey(key)
  }, [focusKey])

  function goTo(target: number, focus = 'heading') {
    if (target === step) {
      focusKey(focus)
      return
    }
    setDirection(target > step ? 1 : -1)
    focusTarget.current = focus
    setStep(target)
    setReachable((atual) => Math.max(atual, target))
    void flush()
  }

  function clearErrors(...keys: string[]) {
    setErrors((atual) => {
      if (!keys.some((key) => key in atual)) return atual
      const proximo = { ...atual }
      for (const key of keys) delete proximo[key]
      return proximo
    })
  }

  function setEmpresa<K extends keyof Empresa>(campo: K, value: Empresa[K]) {
    setState((atual) => ({ ...atual, empresa: { ...atual.empresa, [campo]: value } }))
    clearErrors(`empresa.${campo}`)
  }

  function blurEmpresa(campo: keyof Empresa) {
    const valor = state.empresa[campo]
    if (valor === null || valor === '') return
    const erro = validateEmpresa(state.empresa)[`empresa.${campo}`]
    if (erro) setErrors((atual) => ({ ...atual, [`empresa.${campo}`]: erro }))
  }

  function setSegmento(segmento: Segmento) {
    setState((atual) => ({ ...atual, segmento }))
    clearErrors('segmento')
  }

  function setResposta(campo: string, value: RespostaValor) {
    setState((atual) => ({ ...atual, respostas: { ...atual.respostas, [campo]: value } }))
    const dependentes = Object.keys(CONDICIONAIS).filter((id) => CONDICIONAIS[id] === campo)
    clearErrors(campo, ...(value === true ? [] : dependentes))
  }

  function showErrors(found: Errors) {
    setErrors(found)
    const keys = orderedErrors(found, template)
    setSummaryKeys(keys)
    goTo(stepOfKey(keys[0], template), keys[0])
  }

  function next() {
    if (readOnly) {
      if (step < LAST_STEP) goTo(step + 1)
      return
    }
    const stepErrors = validateStep(step, state, template)
    const keys = orderedErrors(stepErrors, template)
    if (keys.length > 0) {
      setErrors((atual) => ({ ...atual, ...stepErrors }))
      focusKey(keys[0])
      return
    }
    if (returnToReview) {
      setReturnToReview(false)
      goTo(LAST_STEP)
      return
    }
    goTo(step + 1)
  }

  function edit(target: number) {
    setReturnToReview(true)
    goTo(target)
  }

  async function submit() {
    if (readOnly) return
    setSubmitError(null)
    const found = validateAll(state, template)
    if (Object.keys(found).length > 0) {
      showErrors(found)
      return
    }
    setSubmitting(true)
    // Nenhum rascunho pode chegar depois do envio.
    await autosave.suspend()
    try {
      await api.onboarding.saveDraft(toPayload(state, true, template))
      await goToStatus()
    } catch (error) {
      if (isConflict(error)) {
        await goToStatus()
        return
      }
      autosave.resume()
      setSubmitting(false)
      if (isAxiosError(error) && error.response?.status === 422) {
        const body = error.response.data as Partial<OnboardingValidationError> | undefined
        const fromServer = errorsFromServer(body?.campos)
        if (Object.keys(fromServer).length > 0) {
          showErrors(fromServer)
          return
        }
      }
      setSubmitError(errorMessage(error))
    }
  }

  const summaryItems = summaryKeys
    .filter((key) => key in errors)
    .map((key) => ({
      key,
      label: labelOfKey(key, template),
      erro: errors[key],
      passo: STEPS[stepOfKey(key, template)].nome,
    }))

  const completed = STEPS.map(
    (_, index) =>
      index === LAST_STEP || Object.keys(validateStep(index, state, template)).length === 0,
  )

  const variants = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } },
    exit: (dir: number) => ({
      opacity: 0,
      x: reduce ? 0 : dir * -16,
      transition: { duration: 0.12, ease: EASE },
    }),
  }

  const primaryLabel = readOnly
    ? 'Próximo passo'
    : step === LAST_STEP
      ? 'Enviar para análise'
      : returnToReview
        ? 'Voltar à revisão'
        : 'Continuar'

  return (
    <>
      {/* A página de status reabre a reprovação como RASCUNHO: o comentário também conta. */}
      {(draft.onboarding_status === 'REPROVADO' || Boolean(draft.review_comment?.trim())) && (
        <ReprovadoNote comment={draft.review_comment} reviewedAt={draft.reviewed_at} />
      )}
      {readOnly && <ReadOnlyNote />}
      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:pt-2">
          <StepProgress
            current={step}
            reachable={readOnly ? LAST_STEP : reachable}
            completed={completed}
            onGo={(target) => goTo(target)}
          />
        </aside>

        <form
          ref={formRef}
          noValidate
          aria-labelledby="passo-titulo"
          onSubmit={(event) => {
            event.preventDefault()
            if (step === LAST_STEP) void submit()
            else next()
          }}
          className="min-w-0 rounded-panel border border-line bg-surface shadow-raised"
        >
          <div className="space-y-6 px-4 pt-5 sm:px-8 sm:pt-7">
            {summaryItems.length > 0 && (
              <ErrorSummary
                items={summaryItems}
                onGo={(key) => goTo(stepOfKey(key, template), key)}
              />
            )}
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <StepFrame onEntered={onEntered}>
                  <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
                    <h2
                      id="passo-titulo"
                      ref={headingRef}
                      tabIndex={-1}
                      className="mb-5 text-lg font-semibold tracking-[-0.01em] text-ink outline-none"
                    >
                      {STEPS[step].titulo}
                    </h2>
                    {step === 0 && (
                      <EmpresaStep
                        empresa={state.empresa}
                        errors={errors}
                        onChange={setEmpresa}
                        onBlurField={blurEmpresa}
                      />
                    )}
                    {step === 1 && (
                      <SegmentoStep
                        templates={templates}
                        value={state.segmento}
                        error={errors.segmento}
                        onChange={setSegmento}
                      />
                    )}
                    {step === 2 &&
                      (template ? (
                        <PerguntasStep
                          template={template}
                          respostas={state.respostas}
                          errors={errors}
                          onChange={setResposta}
                        />
                      ) : (
                        <p className="text-sm text-ink-muted">
                          Escolha o segmento no passo anterior para ver as perguntas.
                        </p>
                      ))}
                    {step === LAST_STEP && (
                      <RevisaoStep
                        state={state}
                        template={template}
                        errors={errors}
                        onEdit={readOnly ? undefined : edit}
                        onObservacoes={(observacoes) =>
                          setState((atual) => ({ ...atual, observacoes }))
                        }
                      />
                    )}
                  </fieldset>
                </StepFrame>
              </motion.div>
            </AnimatePresence>
            {submitError && (
              <ErrorState
                title="Não conseguimos enviar o cadastro"
                message={`${submitError} Seus dados continuam salvos como rascunho.`}
                onRetry={() => void submit()}
              />
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-4 py-4 sm:px-8">
            {readOnly ? (
              <p className="text-sm text-ink-muted">Somente leitura</p>
            ) : (
              <SaveIndicator status={autosave.status} onRetry={() => void autosave.retry()} />
            )}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {step > 0 && (
                <Button
                  variant="secondary"
                  icon={<ArrowLeft aria-hidden className="size-4" />}
                  onClick={() => goTo(step - 1)}
                  disabled={submitting}
                >
                  Voltar
                </Button>
              )}
              {!(readOnly && step === LAST_STEP) && (
                <Button
                  type="submit"
                  loading={submitting}
                  icon={step === LAST_STEP ? <Send aria-hidden className="size-4" /> : undefined}
                >
                  {primaryLabel}
                  {step < LAST_STEP && <ArrowRight aria-hidden className="size-4" />}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
