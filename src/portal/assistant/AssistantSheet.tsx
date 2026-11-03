import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Landmark,
  ListChecks,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Store,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, domAnimation, LazyMotion, motion, useReducedMotion } from 'motion/react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { Link, useNavigate } from 'react-router'

import { Faisca, Marca } from '@/components/brand/Logo'
import { ReadingMark, ReadingStep } from '@/components/brand/ReadingSteps'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'

import { useMe, useOverview } from '../layout/queries'
import { dayMonth, daysFromToday, isoDay, number, relativeDay } from '../lib/format'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { ErrorState, Skeleton } from '../ui/Surface'

import { AssistantMark } from './AssistantMark'
import { useAssistantContext } from './context'
import { Markdown } from './markdown'
import { readingSteps, stepsFromAnswer, type Etapa } from './reading'
import { chipLabel, iconFor, suggestionsFor, type SugestaoIcone } from './suggestions'
import {
  MAX_CHARS,
  useConversationList,
  type AssistantFailure,
  type ChatEntry,
} from './useAssistant'

const EASE = [0.16, 1, 0.3, 1] as const
/** O contador aparece perto do limite. */
const COUNTER_FROM = MAX_CHARS - 200
/** Intervalo entre as etapas do card de leitura. */
const STEP_MS = 800
/** Quanto o card concluído fica aberto antes de virar resumo. */
const RESOLVE_MS = 900
const DISCLAIMER =
  'Respostas geradas por IA com base nos dados da sua empresa. Confira antes de decidir.'

const ICONS: Record<SugestaoIcone, LucideIcon> = {
  trend: TrendingUp,
  alert: TriangleAlert,
  credit: Landmark,
  list: ListChecks,
  calendar: CalendarDays,
  package: Package,
  store: Store,
  wallet: Wallet,
  receipt: ReceiptText,
  chat: MessageSquare,
}

const iconButton =
  'grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40 max-sm:size-11'

/** Só rotas internas do portal viram botão (a resposta da IA é tratada como dado). */
function isPortalRoute(rota: string) {
  return rota === '/app' || /^\/app[/?#]/.test(rota)
}

/** Segundos que faltam até `until` (atualiza a cada segundo); 0 quando já passou. */
function useSecondsLeft(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))
}

function isNarrow() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639px)').matches
}

interface Turn {
  question: ChatEntry
  answer?: Extract<ChatEntry, { role: 'assistant' }>
}

function toTurns(entries: ChatEntry[]): Turn[] {
  const turns: Turn[] = []
  for (const entry of entries) {
    if (entry.role === 'user') turns.push({ question: entry })
    else if (turns.length && !turns[turns.length - 1].answer) {
      turns[turns.length - 1].answer = entry
    }
  }
  return turns
}

/** Painel do assistente: tela inicial, conversa, lista de conversas e o campo de pergunta. */
export function AssistantSheet() {
  const { open, close, chat } = useAssistantContext()
  const composer = useRef<HTMLTextAreaElement>(null)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [expanded, setExpanded] = useState(false)
  const inConversation = chat.currentId !== null
  // O botão clicado some (a sugestão vira pergunta): o foco vai para o campo, dentro do painel.
  const focusComposer = () => requestAnimationFrame(() => composer.current?.focus())
  const ask = (question: string) => {
    chat.send(question)
    focusComposer()
  }
  const back = () => {
    if (view === 'history') setView('chat')
    else if (isNarrow() || !inConversation) close()
    else chat.newConversation()
    focusComposer()
  }

  const header = (
    <header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Voltar" onClick={back} className={iconButton}>
          <ArrowLeft aria-hidden className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Conversas"
          aria-pressed={view === 'history'}
          onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
          className={cn(iconButton, view === 'history' && 'bg-sunken text-ink')}
        >
          <History aria-hidden className="size-[18px]" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Nova conversa"
          onClick={() => {
            chat.newConversation()
            setView('chat')
            focusComposer()
          }}
          className={iconButton}
        >
          <Plus aria-hidden className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label={expanded ? 'Reduzir painel' : 'Expandir painel'}
          onClick={() => setExpanded((value) => !value)}
          className={cn(iconButton, 'max-sm:hidden')}
        >
          {expanded ? (
            <Minimize2 aria-hidden className="size-[18px]" />
          ) : (
            <Maximize2 aria-hidden className="size-[18px]" />
          )}
        </button>
        <button type="button" aria-label="Fechar" onClick={close} className={iconButton}>
          <X aria-hidden className="size-[18px]" />
        </button>
      </div>
    </header>
  )

  return (
    <Sheet
      open={open}
      onClose={close}
      size={expanded ? 'lg' : 'sm'}
      title="Assistente ErpIa"
      header={header}
      footer={view === 'chat' ? <Composer inputRef={composer} /> : undefined}
    >
      <LazyMotion features={domAnimation}>
        <div className={cn('mx-auto flex min-h-full w-full flex-col', expanded && 'max-w-2xl')}>
          {view === 'history' ? (
            <HistoryView
              onOpen={(id) => {
                chat.openConversation(id)
                setView('chat')
                focusComposer()
              }}
            />
          ) : inConversation ? (
            <Thread
              onAsk={ask}
              onRetry={() => {
                chat.retry()
                focusComposer()
              }}
            />
          ) : (
            <Home onAsk={ask} />
          )}
        </div>
      </LazyMotion>
    </Sheet>
  )
}

function Home({ onAsk }: { onAsk: (question: string) => void }) {
  const { rota, firstName } = useAssistantContext()
  const reduce = useReducedMotion()
  const sugestoes = suggestionsFor(rota)
  return (
    <>
      <motion.div
        className="flex flex-1 flex-col items-center justify-center py-8 text-center"
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <AssistantMark state="idle" size={80} />
        <p className="mt-6 text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
          {firstName ? `Olá, ${firstName}.` : 'Olá.'}
        </p>
        <p className="mt-1.5 text-base text-ink-muted">O que vamos olhar hoje?</p>
      </motion.div>
      <ChipRow
        label="A partir desta tela"
        items={sugestoes.map((s) => ({ key: s.pergunta, label: s.label, icon: s.icone }))}
        onPick={onAsk}
      />
    </>
  )
}

interface ChipItem {
  /** Pergunta enviada. */
  key: string
  label: string
  icon: SugestaoIcone
}

/**
 * Fileira horizontal de sugestões (rolagem com snap, setas e bordas esmaecidas). Cada chip mostra
 * um rótulo curto e envia a pergunta completa; o nome acessível é a pergunta.
 */
function ChipRow({
  label,
  items,
  onPick,
}: {
  label?: string
  items: ChipItem[]
  onPick: (question: string) => void
}) {
  const row = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  const labelId = useId()

  const measure = () => {
    const el = row.current
    if (!el) return
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    })
  }
  useEffect(() => {
    measure()
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length])

  const scroll = (direction: 1 | -1) => {
    const el = row.current
    el?.scrollBy?.({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }
  const overflow = !(edges.start && edges.end)

  return (
    <div className="pb-1">
      {(label || overflow) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {label ? (
            <p id={labelId} className="text-xs font-medium text-ink-faint">
              {label}
            </p>
          ) : (
            <span />
          )}
          {overflow && (
            <div className="flex gap-0.5">
              <button
                type="button"
                aria-label="Sugestões anteriores"
                disabled={edges.start}
                onClick={() => scroll(-1)}
                className={cn(iconButton, 'size-8')}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Mais sugestões"
                disabled={edges.end}
                onClick={() => scroll(1)}
                className={cn(iconButton, 'size-8')}
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
      <ul
        ref={row}
        onScroll={measure}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : 'Próximas perguntas'}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 [scrollbar-width:none] gap-2 overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: `linear-gradient(to right, ${edges.start ? '#000' : 'transparent'}, #000 1.5rem, #000 calc(100% - 1.5rem), ${edges.end ? '#000' : 'transparent'})`,
        }}
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <li key={item.key} className="shrink-0 snap-start">
              <button
                type="button"
                aria-label={item.key}
                title={item.key === item.label ? undefined : item.key}
                onClick={() => onPick(item.key)}
                className="inline-flex h-12 max-w-[18rem] items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-ink transition-colors duration-150 hover:border-line-strong hover:bg-sunken dark:bg-sunken dark:hover:bg-surface"
              >
                <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Thread({ onAsk, onRetry }: { onAsk: (question: string) => void; onRetry: () => void }) {
  const { chat } = useAssistantContext()
  const reduce = useReducedMotion()
  const turns = toTurns(chat.entries)
  const latest = useRef<HTMLElement>(null)

  // Leva a última pergunta ao topo, para a resposta ser lida do começo.
  useEffect(() => {
    latest.current?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [chat.entries.length, chat.pendingQuestion, reduce])

  const lastIndex = chat.pendingQuestion === null ? turns.length - 1 : -1
  if (chat.loading) return <ThreadSkeleton />
  if (chat.loadError) {
    return (
      <div className="pt-2">
        <ErrorState
          title="Não conseguimos abrir esta conversa"
          message={chat.loadError}
          onRetry={chat.reload}
        />
      </div>
    )
  }
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversa com o assistente"
      className="space-y-8 pb-4"
    >
      {turns.map((turn, index) => (
        <TurnView
          key={turn.question.id}
          ref={index === turns.length - 1 && chat.pendingQuestion === null ? latest : undefined}
          question={turn.question.content}
        >
          {turn.answer && (
            <Answer
              entry={turn.answer}
              fresh={turn.answer.id === chat.freshId}
              last={index === lastIndex}
              onAsk={onAsk}
            />
          )}
        </TurnView>
      ))}
      {chat.pendingQuestion !== null && (
        <TurnView ref={latest} question={chat.pendingQuestion}>
          {chat.pending ? (
            <ReadingCard />
          ) : (
            chat.failure && <FailureNotice failure={chat.failure} onRetry={onRetry} />
          )}
        </TurnView>
      )}
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div role="status" aria-label="Carregando a conversa" className="space-y-8 pb-4">
      {[0, 1].map((turn) => (
        <div key={turn} className="space-y-4">
          <Skeleton className="ml-auto h-10 w-3/5 rounded-[1.25rem]" />
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TurnView({
  question,
  children,
  ref,
}: {
  question: string
  children: ReactNode
  ref?: RefObject<HTMLElement | null>
}) {
  return (
    <article ref={ref} className="scroll-mt-2">
      <h3 className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] bg-sunken px-4 py-2.5 text-[0.9375rem] leading-snug font-medium break-words whitespace-pre-wrap text-ink">
        <span className="sr-only">Você perguntou: </span>
        {question}
      </h3>
      {children}
    </article>
  )
}

function StepLabel({ etapa }: { etapa: Etapa }) {
  return (
    <>
      {etapa.trechos.map((trecho, index) =>
        typeof trecho === 'string' ? (
          <span key={index}>{trecho}</span>
        ) : (
          <strong
            key={index}
            className={cn('tabular font-semibold', trecho.atencao ? 'text-warning' : 'text-ink')}
          >
            {trecho.forte}
          </strong>
        ),
      )}
    </>
  )
}

/** Moldura do card de leitura (o mesmo do hero da landing): símbolo, título e empresa. */
function ReadingFrame({
  thinking,
  title,
  children,
}: {
  thinking: boolean
  title: string
  children: ReactNode
}) {
  const { companyName } = useCompany()
  return (
    <div className="mt-4 overflow-hidden rounded-panel border border-line bg-surface dark:bg-sunken">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ReadingMark thinking={thinking} />
          <span role="status" className="truncate text-sm font-medium text-ink">
            {title}
          </span>
        </div>
        {companyName && <span className="truncate text-xs text-ink-faint">{companyName}</span>}
      </div>
      {children}
    </div>
  )
}

/** Empresa e overview já em cache no portal (sem buscar de novo). */
function useCompany() {
  const me = useMe()
  const overview = useOverview()
  return { companyName: me.data?.empresa?.nome_fantasia, overview: overview.data }
}

/** "Lendo seus dados…": etapas da tela atual, uma a cada ~800 ms; a última espera a resposta. */
function ReadingCard() {
  const { rota } = useAssistantContext()
  const { overview } = useCompany()
  const reduce = useReducedMotion()
  const [etapas] = useState(() => readingSteps(rota, overview))
  const [tick, setTick] = useState(reduce ? etapas.length - 1 : 0)

  useEffect(() => {
    if (reduce) return
    const timer = setInterval(
      () => setTick((current) => Math.min(current + 1, etapas.length - 1)),
      STEP_MS,
    )
    return () => clearInterval(timer)
  }, [etapas.length, reduce])

  return (
    <ReadingFrame thinking title="Lendo seus dados…">
      <div
        className="relative h-px w-full overflow-hidden bg-line"
        data-testid="assistant-thinking"
      >
        {!reduce && (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 bg-ink-muted"
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </div>
      <ol aria-hidden className="grid gap-2.5 px-4 py-3.5">
        {etapas.slice(0, tick + 1).map((etapa, index) => (
          <ReadingStep
            key={index}
            shown={index <= tick}
            done={index < tick}
            still={!!reduce}
            duration={index === etapas.length - 1 ? 6 : STEP_MS / 1000}
            label={<StepLabel etapa={etapa} />}
          />
        ))}
      </ol>
    </ReadingFrame>
  )
}

function Answer({
  entry,
  fresh,
  last,
  onAsk,
}: {
  entry: Extract<ChatEntry, { role: 'assistant' }>
  fresh: boolean
  last: boolean
  onAsk: (question: string) => void
}) {
  const { close, rota } = useAssistantContext()
  const { overview } = useCompany()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [resolving, setResolving] = useState(fresh && !reduce)
  const [expanded, setExpanded] = useState(false)
  const [freshSteps] = useState(() => {
    if (!fresh) return null
    const found = stepsFromAnswer([], entry.content)
    return [...readingSteps(rota, overview).slice(0, 4 - found.length), ...found]
  })
  const acoes = entry.acoes.filter((acao) => isPortalRoute(acao.rota))
  const steps = freshSteps ?? stepsFromAnswer(entry.fontes, entry.content)
  const fontes = entry.fontes.length

  useEffect(() => {
    if (!resolving) return
    const timer = setTimeout(() => setResolving(false), RESOLVE_MS)
    return () => clearTimeout(timer)
  }, [resolving])

  return (
    <div className="mt-4">
      <AnimatePresence initial={false} mode="wait">
        {resolving ? (
          <motion.div key="card" exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <ReadingFrame thinking={false} title="Leitura concluída">
              <ol className="grid gap-2.5 px-4 py-3.5">
                {steps.map((etapa, index) => (
                  <ReadingStep
                    key={index}
                    shown
                    done
                    still={index < steps.length - 1}
                    attention={etapa.atencao}
                    label={<StepLabel etapa={etapa} />}
                  />
                ))}
              </ol>
            </ReadingFrame>
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={fresh && !reduce ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-expanded={steps.length ? expanded : undefined}
              disabled={!steps.length}
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full text-xs text-ink-faint transition-colors duration-150 hover:text-ink-muted disabled:cursor-default max-sm:min-h-11"
            >
              <Faisca label={null} className="size-3" />
              <span>
                <span className="text-ink-muted">
                  <span className="sr-only">Resposta da </span>
                  <Marca />
                </span>
                {' · Leitura concluída'}
                {fontes > 0 && ` · ${fontes} ${fontes === 1 ? 'fonte' : 'fontes'}`}
              </span>
              {steps.length > 0 && (
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-3.5 transition-transform duration-150',
                    expanded && 'rotate-180',
                  )}
                />
              )}
            </button>
            {expanded && (
              <ol className="mt-1 mb-2 grid gap-2 border-l border-line pl-3">
                {steps.map((etapa, index) => (
                  <ReadingStep
                    key={index}
                    shown
                    done
                    still
                    attention={etapa.atencao}
                    label={<StepLabel etapa={etapa} />}
                  />
                ))}
              </ol>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="mt-2"
        initial={fresh && !reduce ? { opacity: 0, y: 8 } : false}
        animate={resolving ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
      >
        <Markdown source={entry.content} />

        {fontes > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-2xs text-ink-faint">
            <span className="sr-only">Baseado em:</span>
            {entry.fontes.map((fonte) => (
              <span
                key={`${fonte.tipo}-${fonte.label}`}
                className="rounded-full border border-line px-2 py-0.5 text-ink-muted"
              >
                {fonte.label}
              </span>
            ))}
          </div>
        )}

        {acoes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {acoes.map((acao) => (
              <Button
                key={acao.rota + acao.label}
                variant="secondary"
                size="sm"
                className="rounded-full max-sm:h-11"
                onClick={() => {
                  navigate(acao.rota)
                  close()
                }}
              >
                {acao.label}
                <ArrowRight aria-hidden className="size-3.5 text-ink-muted" />
              </Button>
            ))}
          </div>
        )}

        {last && entry.sugestoes.length > 0 && (
          <div className="mt-5">
            <ChipRow
              items={entry.sugestoes.map((sugestao) => ({
                key: sugestao,
                label: chipLabel(sugestao),
                icon: iconFor(sugestao),
              }))}
              onPick={onAsk}
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** "hoje", "ontem", "há 3 dias"; depois de uma semana, a data ("18 nov"). */
function conversationDate(iso: string, today = new Date()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = isoDay(date)
  return daysFromToday(day, today) < -6 ? dayMonth(day) : relativeDay(day, today)
}

function Confirm({
  question,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  question: string
  confirmLabel: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const group = useRef<HTMLDivElement>(null)
  // O foco vai para "Cancelar": um Enter por engano não apaga.
  useEffect(() => group.current?.querySelector('button')?.focus(), [])
  return (
    <div ref={group} role="group" aria-label={question} className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm font-medium text-ink">{question}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="max-sm:h-11"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="max-sm:h-11"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Apagando…' : confirmLabel}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  )
}

const DELETE_ERROR = 'Não foi possível apagar agora. Tente de novo em instantes.'

function HistoryView({ onOpen }: { onOpen: (id: string) => void }) {
  const { chat } = useAssistantContext()
  const list = useConversationList(true)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [options, setOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const optionsId = useId()
  const conversas = list.data?.pages.flat() ?? []

  const ask = (target: string | null) => {
    setConfirm(target)
    setError(null)
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      setConfirm(null)
      setOptions(false)
    } catch {
      setError(DELETE_ERROR)
    } finally {
      setBusy(false)
    }
  }

  let body: ReactNode
  if (list.isPending) {
    body = (
      <ul role="status" aria-label="Carregando as conversas" className="divide-y divide-line">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="space-y-2 px-2 py-3">
            <Skeleton className={cn('h-3.5', row % 2 ? 'w-3/5' : 'w-4/5')} />
            <Skeleton className="h-3 w-28" />
          </li>
        ))}
      </ul>
    )
  } else if (list.isError) {
    body = (
      <ErrorState
        title="Não conseguimos carregar as conversas"
        message={errorMessage(list.error)}
        onRetry={() => void list.refetch()}
      />
    )
  } else if (conversas.length === 0) {
    body = (
      <div className="flex flex-col items-center py-12 text-center">
        <MessageSquare aria-hidden className="size-5 text-ink-faint" />
        <p className="mt-3 text-sm font-medium text-ink">Suas conversas aparecem aqui.</p>
        <p className="mt-1 max-w-[34ch] text-sm text-ink-muted">
          Cada conversa com a ErpIa fica guardada para você retomar depois, de qualquer tela.
        </p>
      </div>
    )
  } else {
    body = (
      <>
        <ul className="divide-y divide-line border-y border-line">
          {conversas.map((conversa) => (
            <li key={conversa.id} className="py-1">
              {confirm === conversa.id ? (
                <Confirm
                  question="Apagar esta conversa?"
                  confirmLabel="Apagar"
                  busy={busy}
                  error={error}
                  onCancel={() => ask(null)}
                  onConfirm={() => void run(() => chat.deleteConversation(conversa.id))}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpen(conversa.id)}
                    aria-current={conversa.id === chat.currentId || undefined}
                    className="min-w-0 flex-1 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-sunken aria-[current]:bg-sunken"
                  >
                    <span className="block truncate text-sm font-medium text-ink">
                      {conversa.titulo}
                    </span>
                    <span className="tabular block text-xs text-ink-faint">
                      {conversationDate(conversa.updated_at)} · {conversa.mensagens}{' '}
                      {conversa.mensagens === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Apagar a conversa "${conversa.titulo}"`}
                    onClick={() => ask(conversa.id)}
                    className={iconButton}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {list.hasNextPage && (
          <div className="mt-3 flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            >
              {list.isFetchingNextPage ? 'Carregando…' : 'Mostrar mais conversas'}
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <section aria-labelledby="assistant-history" className="pb-4">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-2">
        <h3 id="assistant-history" className="text-sm font-semibold text-ink">
          Conversas
        </h3>
        {conversas.length > 0 && (
          <button
            type="button"
            aria-label="Opções do histórico"
            aria-expanded={options}
            aria-controls={optionsId}
            onClick={() => {
              setOptions((value) => !value)
              if (confirm === 'all') ask(null)
            }}
            className={cn(iconButton, 'size-9', options && 'bg-sunken text-ink')}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {options && conversas.length > 0 && (
        <div id={optionsId} className="mb-3 rounded-panel bg-sunken px-3 py-1">
          {confirm === 'all' ? (
            <Confirm
              question="Apagar todas as conversas?"
              confirmLabel="Apagar tudo"
              busy={busy}
              error={error}
              onCancel={() => ask(null)}
              onConfirm={() => void run(chat.deleteAll)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <p className="text-xs text-ink-muted">Apaga as conversas de todas as telas.</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-negative max-sm:h-11"
                onClick={() => ask('all')}
              >
                Apagar todo o histórico
              </Button>
            </div>
          )}
        </div>
      )}
      {body}
    </section>
  )
}

function FailureNotice({ failure, onRetry }: { failure: AssistantFailure; onRetry: () => void }) {
  const { close, chat } = useAssistantContext()
  const wait = useSecondsLeft(chat.blockedUntil)
  let message: string
  let action: ReactNode = (
    <Button
      variant="secondary"
      size="sm"
      className="mt-2.5 rounded-full max-sm:h-11"
      onClick={onRetry}
      disabled={wait > 0}
    >
      Tentar de novo
    </Button>
  )
  switch (failure.kind) {
    case 'indisponivel':
      message = 'O assistente está indisponível no momento. Tente de novo em alguns minutos.'
      break
    case 'limite':
      message = `Você atingiu o limite de 10 perguntas por minuto. Tente de novo em ${
        wait > 0 ? `${wait} s` : 'instantes'
      }.`
      break
    case 'permissao':
      message = 'Peça a um administrador a permissão de usar o assistente.'
      action = null
      break
    case 'perdida':
      message =
        'Esta conversa não está mais disponível. Tente de novo para perguntar numa conversa nova.'
      break
    case 'onboarding':
      message = 'O assistente fica disponível depois que o cadastro da empresa for aprovado.'
      action = (
        <Link
          to="/app/status"
          onClick={close}
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline max-sm:min-h-11"
        >
          Ver o status do cadastro
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      )
      break
    default:
      message = failure.message
  }
  return (
    <div role="alert" className="mt-4 flex gap-2.5 rounded-panel border border-line px-4 py-3">
      <AlertCircle
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          failure.kind === 'falha' || failure.kind === 'indisponivel'
            ? 'text-negative'
            : 'text-warning',
        )}
      />
      <div className="text-sm text-ink">
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}

const stamp = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** "03/11 17:42" (sem a vírgula do Intl). */
function dataStamp(ms: number) {
  return stamp.format(new Date(ms)).replace(',', '')
}

function Composer({ inputRef }: { inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const { chat, draft: text, setDraft: setText } = useAssistantContext()
  const overview = useOverview()
  const id = useId()
  const near = text.length >= COUNTER_FROM
  const blocked = useSecondsLeft(chat.blockedUntil) > 0
  const canSend = text.trim().length > 0 && !chat.pending && !blocked
  const [mountedAt] = useState(() => Date.now())
  const updatedAt = overview.dataUpdatedAt || mountedAt

  // Pergunta pré-preenchida (ex. "Perguntar à ErpIa sobre isso"): cursor no fim do texto.
  useEffect(() => {
    const input = inputRef.current
    if (input?.value) input.setSelectionRange(input.value.length, input.value.length)
  }, [inputRef])

  const submit = () => {
    if (!canSend) return
    chat.send(text)
    setText('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <form
      className="mx-auto w-full max-w-2xl space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Sua pergunta para a ErpIa
      </label>
      <div className="rounded-[1.375rem] border border-line bg-surface px-4 pt-3 pb-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--erpia-accent-soft)] dark:bg-sunken">
        <textarea
          ref={inputRef}
          id={id}
          data-autofocus
          rows={1}
          maxLength={MAX_CHARS}
          value={text}
          readOnly={chat.pending}
          aria-describedby={`${id}-hint${near ? ` ${id}-count` : ''}`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Converse com a ErpIa…"
          className="block [field-sizing:content] max-h-48 min-h-12 w-full resize-none bg-transparent text-[0.9375rem] leading-6 text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-2xs text-ink-faint">
            <Clock aria-hidden className="size-3" />
            dados de {dataStamp(updatedAt)}
          </span>
          <div className="flex items-center gap-2">
            {near && (
              <span
                id={`${id}-count`}
                className={cn(
                  'tabular text-2xs text-ink-faint',
                  text.length >= MAX_CHARS && 'text-negative',
                )}
              >
                {number(text.length)}/{number(MAX_CHARS)}
              </span>
            )}
            <button
              type="submit"
              aria-label="Enviar pergunta"
              disabled={!canSend}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-faint dark:disabled:bg-surface"
            >
              <ArrowUp aria-hidden className="size-[18px]" />
            </button>
          </div>
        </div>
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Enter envia; Shift + Enter quebra a linha.
      </p>
      <p className="text-center text-2xs text-ink-faint">{DISCLAIMER}</p>
    </form>
  )
}
